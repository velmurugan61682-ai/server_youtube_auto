/**
 * Subscription Plan Feature Flags & Limits Configuration
 * Defines max channels allowed and feature access per plan tier.
 */
export const PLAN_FEATURES = {
  free: {
    name: 'Free Trial',
    maxChannels: 1,
    autoMod: true,
    commentAutomation: true,
    liveChatAutomation: false
  },
  three_months_999: {
    name: 'Pro Plan (₹999)',
    maxChannels: 1,
    autoMod: true,
    commentAutomation: true,
    liveChatAutomation: true
  },
  // Backward compatibility fallback for professional / active subs
  professional: {
    name: 'Pro Plan',
    maxChannels: 1,
    autoMod: true,
    commentAutomation: true,
    liveChatAutomation: true
  }
};

export const getPlanFeatures = (planType = 'free') => {
  return PLAN_FEATURES[planType] || PLAN_FEATURES.free;
};
