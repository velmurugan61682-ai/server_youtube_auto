/**
 * Subscription Plan Feature Flags & Limits Configuration
 * Defines max channels allowed and feature access per plan tier.
 * Only supported plan names: 'free' and 'pro'.
 */
export const PLAN_FEATURES = {
  free: {
    name: 'Free Plan',
    maxChannels: 1,
    autoMod: true,
    commentAutomation: true,
    liveStreamingCommentReply: false,
    toxicCommentRemove: false,
    autoDM: false
  },
  pro: {
    name: 'Pro Plan (₹999/month)',
    maxChannels: 1,
    autoMod: true,
    commentAutomation: true,
    liveStreamingCommentReply: true,
    toxicCommentRemove: true,
    autoDM: true
  }
};

export const normalizePlanName = (planType = 'free') => {
  const p = (planType || '').toLowerCase().trim();
  if (p === 'pro' || p.includes('999') || p.includes('quarterly') || p.includes('professional') || p.includes('yearly') || p.includes('three_months')) {
    return 'pro';
  }
  return 'free';
};

export const getPlanFeatures = (planType = 'free') => {
  const normalized = normalizePlanName(planType);
  return PLAN_FEATURES[normalized] || PLAN_FEATURES.free;
};

export const hasFeatureAccess = (userOrPlan, featureName) => {
  let planType = 'free';
  if (typeof userOrPlan === 'string') {
    planType = userOrPlan;
  } else if (userOrPlan) {
    planType = userOrPlan.plan || userOrPlan.planId || userOrPlan.subscription?.planId || userOrPlan.subscription?.planType || 'free';
  }
  const features = getPlanFeatures(planType);
  return Boolean(features[featureName]);
};

