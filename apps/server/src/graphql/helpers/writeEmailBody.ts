import { camelToDashCase, uncapitalize } from '@cristata/utils';
import { get as getProperty } from 'object-path';
import pluralize from 'pluralize';
import { Context } from '../server';

interface WriteEmailBody {
  model: string;
  identifier: string;
  fields: Array<{
    name: string;
    label: string;
    numMap?: Record<number, string>;
  }>;
  isMandatory?: boolean;
  data: Record<string, unknown>;
  context: Context;
}

function writeEmailBody({ model, identifier, fields, isMandatory, data, context }: WriteEmailBody): string {
  const message = `The stage has been changed for a document you are watching on Cristata.`;

  const view = `
    This view the document, go to
    <a href="${process.env.APP_URL}/${context.profile?.tenant || '[[TENANT]]'}/cms/collection/${camelToDashCase(
    pluralize(uncapitalize(model))
  )}/${identifier}">
    ${process.env.APP_URL}/${context.profile?.tenant || '[[TENANT]]'}/cms/collection/${camelToDashCase(
    pluralize(uncapitalize(model))
  )}/${identifier}</a>.
  `;

  const values = fields.map((field) => {
    let fieldValue = getProperty(data, field.name);
    if (field.numMap) fieldValue = field.numMap[fieldValue];
    return `
      <span>
        <b>${field.label}: </b>
        ${fieldValue}
      </span>
    `;
  });

  let reason = 'you participated in this document or clicked the <b>Watch</b> button on Cristata';
  if (isMandatory) {
    reason = `you are listed as a mandatory listener for important changes in this document`;
  }

  return `
    <p>
      ${message}
      <br />
      ${view}
    </p>
    <p>
      ${values.join('<br />')}
    </p>
    <p style="color: #888888">
      You receievd this email because ${reason}.
    </p>
  `;
}

export { writeEmailBody };
