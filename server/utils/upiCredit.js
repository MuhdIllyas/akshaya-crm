// Reading UPI payments out of what the companion phone forwards:
//   - bank credit SMS          → parseBankCreditSms(sender, text)
//   - UPI app notifications    → parseAppNotification(pkg, title, body)
// Both return { amount, utr, payer, account_last4, source } or null when the
// message is not a money-received message (OTPs, debits, offers, requests…).

// ---------- Who may report a payment ----------

// Bank SMS in India come from a registered header such as "VM-SBIUPI" or
// "AD-SBIINB-S". A normal phone number can send any text, so only headers are
// trusted, and only ones that name a bank below. Extra headers can be added
// with UPI_SMS_SENDERS in .env (comma separated, e.g. "SBIUPI,SBIINB").
const BANK_CODES = [
  "SBI", "HDFC", "ICICI", "AXIS", "KOTAK", "CANBNK", "CNRB", "FEDBNK", "FEDBK",
  "SIBSMS", "SIBANK", "UNIONB", "UBOI", "BOIIND", "PNB", "IDFC", "YESB",
  "KVB", "CSB", "KGBANK", "KERGB", "ESAF", "IOB", "INDBNK", "BOB", "CENTBK",
];

const extraSenders = () =>
  String(process.env.UPI_SMS_SENDERS || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

/** "VM-SBIUPI-S" → "SBIUPI"; returns null for phone numbers. */
export function smsHeader(sender) {
  const s = String(sender || "").trim().toUpperCase();
  if (!s || /^\+?\d[\d\s-]*$/.test(s)) return null;           // a phone number
  const m = s.match(/^(?:[A-Z]{2}-)?([A-Z0-9]{3,9})(?:-[A-Z])?$/);
  return m ? m[1] : null;
}

export function isTrustedBankSender(sender) {
  const header = smsHeader(sender);
  if (!header) return false;
  if (extraSenders().includes(header)) return true;
  return BANK_CODES.some((code) => header.includes(code));
}

// Android package → our source name. Only these apps' notifications are read.
export const UPI_APP_PACKAGES = {
  "com.google.android.apps.nbu.paisa.merchant": "gpay",   // Google Pay for Business
  "com.google.android.apps.nbu.paisa.user": "gpay",       // Google Pay
  "com.paytm.business": "paytm",                          // Paytm for Business
  "net.one97.paytm": "paytm",                             // Paytm
  "com.phonepe.app": "phonepe",                           // PhonePe
  "com.phonepe.app.business": "phonepe",                  // PhonePe Business
  "com.sbi.upi": "sbi",                                   // BHIM SBI Pay
  "com.sbi.lotusintouch": "sbi",                          // YONO SBI
};

export const UPI_SOURCES = ["sms", "gpay", "paytm", "phonepe", "sbi"];

// ---------- Text helpers ----------

const AMOUNT = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

/** The paid amount: the first Rs/INR/₹ figure that is not a balance. */
export function extractAmount(text) {
  for (const m of String(text).matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, m.index - 25), m.index).toLowerCase();
    if (/(bal|balance|limit|avl|available)[^a-z]*$/.test(before)) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) return Math.round(value * 100) / 100;
  }
  return null;
}

/** UPI reference / UTR / RRN: 10–16 digits after a "Ref"-type word. */
export function extractUtr(text) {
  const m = String(text).match(
    /(?:upi\s*ref(?:erence)?|ref(?:erence)?|utr|rrn|txn(?:\s*id)?|transaction\s*id)\s*(?:no\.?|number|id)?\s*[:.#-]?\s*(\d{10,16})\b/i
  );
  return m ? m[1] : null;
}

/** "A/c XX1234", "A/cX1234", "a/c no. ****1234", "account ending 1234" → "1234". */
export function extractAccountLast4(text) {
  const m = String(text).match(
    /(?:a\/c|acct|account|ac)\.?\s*(?:no\.?|number|ending(?:\s*with)?)?\s*[:.]?\s*[x*.]*\s*(\d{3,6})\b/i
  );
  return m ? m[1].slice(-4) : null;
}

const VPA = /\b([a-z0-9][a-z0-9._-]{1,60}@[a-z]{2,20})\b/i;

function extractPayer(text) {
  const vpa = String(text).match(VPA);
  // "Ramesh Kumar paid you ₹100" / "Ramesh sent you ₹100"
  const subject = String(text).match(/(?:^|—\s*)([A-Za-z][A-Za-z .']{1,40}?)\s+(?:paid|sent)\s+you\b/i);
  if (subject) return subject[1].trim();
  // Every "from / by …" phrase in turn: "credited by Rs.1.00 … transfer from
  // RAMESH K Ref…" has an amount after the first "by", the name after "from".
  // A name ends at a following word (on, ref…), punctuation or a dash ("—").
  const NAME = /(?:received from|paid by|transfer from|\bfrom|\bby)\s+([A-Za-z][A-Za-z .']{1,40}?)(?=\s+(?:on|ref|via|to|upi|with|at|in|deposited|from|by)\b|\s*[(.,\-\u2013\u2014|:]|$)/gi;
  let n = null;
  for (const m of String(text).matchAll(NAME)) {
    const candidate = m[1].trim();
    if (!/^(rs|inr|upi|a\/c|ac|transfer|neft|imps|your|ur)\b/i.test(candidate)) { n = candidate; break; }
  }
  if (n && vpa) return `${n} (${vpa[1]})`;
  return n || (vpa ? vpa[1] : null);
}

// Never a received payment: requests, debits, failures, offers.
const NOT_A_CREDIT =
  /(requested|request(?:ing)? (?:money|for)|collect request|will be credited|to be credited|pending|failed|declined|reversed|cashback|reward|offer|reminder|due|debited|sent to|paid to|you paid|payment of .* to)/i;

// ---------- Parsers ----------

// A UPI app paying out the day's collections in one lump (GPay / Paytm /
// PhonePe settlement). Not a customer payment: kept as source "settlement"
// for checking against the day's app notifications, never shown as "received".
// A customer paying from the Paytm app shows "98xxxx@paytm" in the SMS, so
// UPI ids are removed first, and a company name only counts on a bank
// transfer (NEFT/IMPS/RTGS), which is how settlements arrive.
const SETTLEMENT_WORD = /\b(settlement|settled|merchant\s*payout)\b/i;
const AGGREGATOR = /(google\s*india|google\s*pay|gpay|paytm|one\s*97|phonepe|bharatpe|razorpay|cashfree|pine\s*labs)/i;
const BANK_TRANSFER = /\b(neft|imps|rtgs)\b/i;

export function isSettlementSms(text) {
  const t = String(text || "").replace(new RegExp(VPA.source, "gi"), " ");
  if (SETTLEMENT_WORD.test(t)) return true;
  return AGGREGATOR.test(t) && BANK_TRANSFER.test(t);
}

/** A bank's "account credited" SMS → payment, or null. */
export function parseBankCreditSms(sender, text) {
  const body = String(text || "");
  if (!isTrustedBankSender(sender)) return null;
  if (!/(credited|credit of|has a credit|deposited|received)/i.test(body)) return null;
  // A message that says both (e.g. "debited … credited to beneficiary") is a transfer out.
  if (/debited/i.test(body)) return null;
  if (NOT_A_CREDIT.test(body.replace(/debited/gi, ""))) return null;
  const amount = extractAmount(body);
  if (!amount) return null;
  return {
    source: isSettlementSms(body) ? "settlement" : "sms",
    amount,
    utr: extractUtr(body),
    account_last4: extractAccountLast4(body),
    payer: extractPayer(body),
  };
}

/** A UPI app's "₹100 received from …" notification → payment, or null. */
export function parseAppNotification(pkg, title, body) {
  const source = UPI_APP_PACKAGES[String(pkg || "")];
  if (!source) return null;
  const text = [title, body].filter(Boolean).join(" — ");
  if (!/(received|paid you|credited|got ₹|payment of ₹[\d,.]+ received|sent you)/i.test(text)) return null;
  // Merchant apps add where the money goes next ("The amount will be sent to
  // your bank account." — GPay for Business). That is not a payment going out.
  const checked = text.replace(
    /(?:the\s+)?(?:amount|money)\s+will\s+be\s+(?:sent|credited|transferred|settled|deposited)\s+(?:to|in|into)\s+your\s+(?:bank\s+)?(?:account|a\/c)\.?/gi,
    " "
  );
  if (NOT_A_CREDIT.test(checked)) return null;
  const amount = extractAmount(text);
  if (!amount) return null;
  return {
    source,
    amount,
    utr: extractUtr(text),
    account_last4: null,
    payer: extractPayer(text),
  };
}
