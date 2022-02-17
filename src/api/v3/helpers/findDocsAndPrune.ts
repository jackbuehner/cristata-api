import mongoose, { FilterQuery } from 'mongoose';
import { findDocs, pruneDocs } from '.';
import { Context } from '../../../apollo';

interface FindDocsAndPrune {
  model: string;
  args: {
    _ids?: mongoose.Types.ObjectId[];
    filter?: FilterQuery<unknown>;
    sort?: string | Record<string, unknown>;
    page?: number;
    offset?: number;
    limit: number;
    pipeline2?: mongoose.PipelineStage[];
  };
  context: Context;
  keep: string[];
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
}

async function findDocsAndPrune<ReturnDocType>({
  model,
  args,
  context,
  keep,
  fullAccess,
  accessRule,
}: FindDocsAndPrune): Promise<PaginatedDocs<ReturnDocType>> {
  const paged: PaginatedDocs = await findDocs({ model, args, context, fullAccess, accessRule });

  const pruncedDocs = pruneDocs({
    input: paged.docs,
    keep,
  });

  return {
    ...paged,
    docs: pruncedDocs,
  };
}

export { findDocsAndPrune };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PaginatedDocs<T = any> {
  docs: mongoose.Document<T>[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number;
  nextPage: number;
}
