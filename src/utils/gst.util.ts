export interface GstBreakdown {
  grossAmount: number;
  taxableAmount: number;
  gstAmount: number;
  razorpayFee: number;
  razorpayGst: number;
  netSettlementAmount: number;
}

const GST_RATE = 0.18;
const RAZORPAY_FEE_RATE = 0.02;

/** GST-inclusive plan amount → taxable, GST, Razorpay fee, net settlement. */
export const calculateGstBreakdown = (grossAmount: number): GstBreakdown => {
  const taxableAmount = Math.round((grossAmount / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((grossAmount - taxableAmount) * 100) / 100;
  const razorpayFee = Math.round(grossAmount * RAZORPAY_FEE_RATE * 100) / 100;
  const razorpayGst = Math.round(razorpayFee * GST_RATE * 100) / 100;
  const netSettlementAmount =
    Math.round((grossAmount - razorpayFee - razorpayGst) * 100) / 100;

  return {
    grossAmount,
    taxableAmount,
    gstAmount,
    razorpayFee,
    razorpayGst,
    netSettlementAmount,
  };
};
