-- Who collected a pending payment. The money (wallet_transactions.staff_id)
-- counts for the staff member who did the service; when an admin or a
-- supervisor collects it for them, this keeps who actually took the money,
-- for the payment receipt. Empty for payments saved before this.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS collected_by INTEGER REFERENCES staff(id) ON DELETE SET NULL;
