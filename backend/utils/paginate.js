/**
 * Shared MongoDB pagination utility helper.
 * Standardizes pagination across list endpoints.
 *
 * @param {import('mongoose').Model} Model - Mongoose model
 * @param {Object} query - MongoDB filter query
 * @param {Object} options - Pagination options { page, limit, sort, populate, select }
 * @returns {Promise<{ data: Array, pagination: { page: number, limit: number, total: number, pages: number } }>}
 */
async function paginate(Model, query = {}, { page = 1, limit = 20, sort = { createdAt: -1 }, populate, select } = {}) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const currentLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (currentPage - 1) * currentLimit;

  let queryBuilder = Model.find(query).sort(sort).skip(skip).limit(currentLimit);

  if (select) {
    queryBuilder = queryBuilder.select(select);
  }
  if (populate) {
    queryBuilder = queryBuilder.populate(populate);
  }

  const [data, total] = await Promise.all([
    queryBuilder.lean(),
    Model.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      pages: Math.ceil(total / currentLimit)
    }
  };
}

module.exports = { paginate };
