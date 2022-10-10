import { camelToDashCase, uncapitalize } from '@jackbuehner/cristata-utils';
import { get as getProperty } from 'object-path';
import pluralize from 'pluralize';

interface WriteWatcherEmailBody {
  model: string;
  identifier: string;
  fields: Array<{
    name: string;
    label: string;
  }>;
  isMandatory?: boolean;
  data: Record<string, unknown>;
  tenant: string;
  appOrigin: string;
}

function writeWatcherEmailBody({
  model,
  identifier,
  fields,
  isMandatory,
  data,
  tenant,
  appOrigin,
}: WriteWatcherEmailBody): string {
  const message = `The stage has been changed for a document you are watching on Cristata.`;

  const view = `
    This view the document, go to
    <a href="${appOrigin}/${tenant || '[[TENANT]]'}/cms/collection/${camelToDashCase(
    pluralize(uncapitalize(model))
  )}/${identifier}">
    ${appOrigin}/${tenant || '[[TENANT]]'}/cms/collection/${camelToDashCase(
    pluralize(uncapitalize(model))
  )}/${identifier}</a>.
  `;

  const values = fields.map((field) => {
    const fieldValue = getProperty(data, field.name);
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

export { writeWatcherEmailBody };
