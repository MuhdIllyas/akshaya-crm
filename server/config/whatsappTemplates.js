export const whatsappTemplates = {
  OTP_APP: {
    build: ({ otp }) => ({
      type: "template",
      template: {
        name: "otp_app",
        language: {
          code: "en",
          policy: "deterministic"
        },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: otp }]
          }
        ]
      }
    })
  }
};