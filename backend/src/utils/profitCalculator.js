export const calculateShares = (totalAmount, contributors) => {
  const totalPercentage = contributors.reduce(
    (sum, c) => sum + c.sharePercentage, 
    0
  );

  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error('Contributor percentages must sum to 100');
  }

  return contributors.map(contributor => ({
    contributorId: contributor.id,
    amount: (totalAmount * contributor.sharePercentage) / 100,
    sharePercentage: contributor.sharePercentage,
  }));
};

export const calculateROI = (investment, returns) => {
  return ((returns - investment) / investment * 100).toFixed(2);
};

export const calculateProfitMargins = (revenue, expenses) => {
  const grossProfit = revenue - expenses;
  return {
    grossProfit,
    grossMargin: revenue ? (grossProfit / revenue * 100).toFixed(2) : 0,
    netMargin: revenue ? ((grossProfit - expenses) / revenue * 100).toFixed(2) : 0,
  };
};