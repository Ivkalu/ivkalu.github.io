// Who pays whom, with as few transfers as possible.
//
// balances: { name: cents } where positive = gets money back, negative = owes.
// The minimum number of transfers is (people with a non-zero balance) minus
// (the most groups they can be split into that each sum to zero), because a
// zero-sum group of k people always settles in k - 1 transfers. That maximum
// is found exactly over all subsets (fine up to ~18 people); for bigger groups
// it falls back to the usual greedy matching.
function settle(balances) {
  const people = Object.keys(balances).filter((name) => balances[name] !== 0);
  const amounts = people.map((name) => balances[name]);
  const n = people.length;
  if (n === 0) return [];

  let order;
  if (n <= 18) {
    const size = 1 << n;
    const total = new Array(size).fill(0);
    const best = new Int8Array(size); // most zero-sum groups the subset splits into
    for (let mask = 1; mask < size; mask++) {
      const low = mask & -mask;
      total[mask] = total[mask ^ low] + amounts[31 - Math.clz32(low)];
      let most = 0;
      for (let rest = mask; rest; rest &= rest - 1) {
        const bit = rest & -rest;
        if (best[mask ^ bit] > most) most = best[mask ^ bit];
      }
      best[mask] = most + (total[mask] === 0 ? 1 : 0);
    }
    // Walk back to an order of people in which the zero-sum groups are consecutive
    order = [];
    let mask = size - 1;
    while (mask) {
      const need = best[mask] - (total[mask] === 0 ? 1 : 0);
      for (let rest = mask; rest; rest &= rest - 1) {
        const bit = rest & -rest;
        if (best[mask ^ bit] === need) {
          order.unshift(31 - Math.clz32(bit));
          mask ^= bit;
          break;
        }
      }
    }
  } else {
    order = people.map((_, i) => i);
  }

  // Split the order into zero-sum groups and settle each one greedily
  const groups = [];
  let current = [];
  let running = 0;
  for (const i of order) {
    current.push(i);
    running += amounts[i];
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  const transfers = [];
  for (const group of groups) {
    const debtors = group.filter((i) => amounts[i] < 0).map((i) => ({ name: people[i], left: -amounts[i] }));
    const creditors = group.filter((i) => amounts[i] > 0).map((i) => ({ name: people[i], left: amounts[i] }));
    debtors.sort((a, b) => b.left - a.left);
    creditors.sort((a, b) => b.left - a.left);
    let d = 0;
    let c = 0;
    while (d < debtors.length && c < creditors.length) {
      const amount = Math.min(debtors[d].left, creditors[c].left);
      transfers.push({ from: debtors[d].name, to: creditors[c].name, amount });
      debtors[d].left -= amount;
      creditors[c].left -= amount;
      if (debtors[d].left === 0) d++;
      if (creditors[c].left === 0) c++;
    }
  }
  return transfers;
}

if (typeof module !== 'undefined') module.exports = { settle };
