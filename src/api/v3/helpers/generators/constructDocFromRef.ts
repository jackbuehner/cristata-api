import mongoose from 'mongoose';
import { get as getProperty, set as setProperty } from 'object-path';
import { Context } from '../../../../apollo';
import { findDoc } from '..';

interface ConstructDocFromRef {
  parentDoc: mongoose.LeanDocument<mongoose.Document>;
  model: string;
  /**
   * The field in the referenced document that is used to indetify the
   * desired document. Must match the field from the parent document.
   */
  by: string;
  /**
   * The field from the parent doc that has the same value in the referenced doc.
   */
  from: string;
  /**
   * The field to get from the referenced document.
   */
  field: string;
  /**
   * Where the referenced field value will be inserted into the parent doc.
   */
  to: string;
  context: Context;
}

async function constructDocFromRef({
  parentDoc,
  model,
  by,
  from,
  field,
  to,
  context,
}: ConstructDocFromRef): Promise<mongoose.LeanDocument<mongoose.Document>> {
  // get the referenced doc
  const refDoc = (
    await findDoc({
      model,
      by,
      _id: getProperty(parentDoc, from),
      context,
      fullAccess: true,
    })
  )?.toObject();

  // if the referenced doc does not exist, return the parent doc
  if (!refDoc) return { ...parentDoc };

  // get the referenced field from the referenced doc
  const refField = getProperty(refDoc, field);

  // construct a doc with the referenced field inserted
  const constructedDoc: mongoose.LeanDocument<mongoose.Document> = { ...parentDoc };
  setProperty(constructedDoc, to, refField);

  // return the constructed doc
  return constructedDoc;
}

export { constructDocFromRef };
