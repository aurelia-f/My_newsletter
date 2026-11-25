// Catches errors from async routes without a try/catch everywhere.
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// The last middleware in the chain: it turns any uncaught error
// into clean JSON, never an Express HTML page.
function errorHandler(err, req, res, _next) {
  console.error('💥', err.message);

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'That already exists.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ error: 'Invalid reference.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error.' });
}

module.exports = { wrap, errorHandler };
