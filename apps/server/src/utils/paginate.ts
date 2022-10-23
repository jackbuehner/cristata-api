import mongoose, { PipelineStage } from 'mongoose';
import { AggregateOptions } from 'mongoose/node_modules/mongodb';

interface AggregatePaginateOptions extends AggregateOptions {
  page?: number;
  limit: number;
  sort?: PipelineStage.Sort['$sort'];
  project?: PipelineStage.Project['$project'];
}

interface AggregateResult {
  metadata: [{ total: number }];
  docs: Record<string, unknown>[];
}

interface AggregatePaginateResult {
  docs: Record<string, unknown>[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  nextPage: number | null;
  hasPrevPage: boolean;
  prevPage: number | null;
}

async function paginate<T>(
  Model: mongoose.Model<T>,
  pipeline: mongoose.PipelineStage[],
  { page, limit, sort, project, ...aggregateOpts }: AggregatePaginateOptions
): Promise<AggregatePaginateResult> {
  const $page = page || 1;
  const $limit = limit;
  const $sort = sort || {};
  const $skip = limit * ($page - 1);

  // use provided projection, but fall back to exlcuding y fields (which can be quite large)
  const $project = project ? project : { __yState: 0, __yVersions: 0, yState: 0, __migrationBackup: 0 };

  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      docs: [{ $skip }, { $limit }, { $project }, { $sort }],
    },
  });

  const result = await Model.aggregate<AggregateResult>(pipeline, aggregateOpts)
    .exec()
    .then((res): AggregatePaginateResult => {
      const page = $page;
      const result = res[0];
      const docs = result.docs;
      const totalDocs = result.metadata[0].total;
      const totalPages = Math.ceil(totalDocs / limit);
      const hasNextPage = page < totalPages;
      const nextPage = hasNextPage ? page + 1 : null;
      const hasPrevPage = page > 1;
      const prevPage = hasPrevPage ? page - 1 : null;

      return { docs, totalDocs, limit, page, totalPages, hasNextPage, nextPage, hasPrevPage, prevPage };
    });

  return result;
}
export { paginate };
