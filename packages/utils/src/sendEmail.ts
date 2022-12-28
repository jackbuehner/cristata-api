interface EmailConfig {
  defaultSender: string;
  tenantDisplayName: string;
  secrets?: {
    accessKeyId: string;
    secretAccessKey: string;
  } | null;
}

/**
 * Send an HTML email using Amazon SES.
 * @param to email address of destination person
 * @param subject subject of the email
 * @param message HTML message of the email (not plain text)
 * @param from email address of the sender; defaults to `config.defaultSender`
 */
function sendEmail(
  config: EmailConfig,
  to: string | string[],
  subject: string,
  message: string,
  from = config.defaultSender
): void {
  if (typeof window !== 'undefined') {
    throw new Error('You cannot use `sendEmail()` in the browser');
  }

  import('aws-sdk').then((aws) => {
    // set the region to us-east
    aws.config.update({
      region: 'us-east-1',
    });

    const ses = new aws.SES({ apiVersion: '2010-12-01', credentials: config?.secrets });

    const Data = `
      <h1 style="font-size: 20px;">
        ${config.tenantDisplayName}
      </h1>
      ${message}
      <p style="color: #aaaaaa">
        Powered by Cristata
        <br />
        <span style="font-size: 12px; line-height: 12px;">© Jack Buehner</span>
      </p>
    `;
    const params = {
      Destination: {
        ToAddresses: typeof to === 'string' ? [to] : to,
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data,
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: subject,
        },
      },
      ReturnPath: from,
      Source: from,
    };
    ses.sendEmail(params, (err) => {
      if (err) {
        return console.error(err, err.stack);
      }
    });
  });
}

export { sendEmail };
