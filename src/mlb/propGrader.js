const EPSILON = 1e-9;

function gradeProp({ value, threshold, direction }) {
  const dir = String(direction || '').toLowerCase();
  if (dir !== 'over' && dir !== 'under') {
    throw new Error('direction must be over or under');
  }
  const diff = Number(value) - Number(threshold);
  if (Math.abs(diff) < EPSILON) return 'push';
  if (diff > 0) return dir === 'over' ? 'win' : 'loss';
  return dir === 'over' ? 'loss' : 'win';
}

module.exports = { gradeProp };
