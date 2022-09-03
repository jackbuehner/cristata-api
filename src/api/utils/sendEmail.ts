import aws from 'aws-sdk';
import dotenv from 'dotenv';
import { Configuration } from '../types/config';

// load environmental variables
dotenv.config();

// set the region to us-east
aws.config.update({
  region: 'us-east-1',
});

/**
 * Send an HTML email using Amazon SES.
 * @param to email address of destination person
 * @param subject subject of the email
 * @param message HTML message of the email (not plain text)
 * @param from email address of the sender; defaults to `config.defaultSender`
 */
function sendEmail(
  config: Configuration,
  to: string | string[],
  subject: string,
  message: string,
  from = config.defaultSender
): void {
  const ses = new aws.SES({ apiVersion: '2010-12-01', credentials: config?.secrets.aws });

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
}

export { sendEmail };
