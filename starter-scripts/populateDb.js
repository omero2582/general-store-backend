import '../config/env.js'
import '../config/database.js';
import SubscriptionPlan from "../models/SubscriptionPlan.js";

// TODO, just copy paster this from project-gg (savesearch).
// TODO, we would have to do something similar here next time
async function createSubscriptions() {
  const subscriptions = [
    { _id: 0, name: 'Free', tier: 0 },
    { _id: 1, name: 'Pro', tier: 1 },
    // { name: 'Advanced', tier: 1 },
    // { name: 'Plus', tier: 2 },
  ];
  
  for (const sub of subscriptions) {
    try {
      const newSubscriptionPlans = new SubscriptionPlan(sub);
      await newSubscriptionPlans.save();
    } catch (err) {
      console.log('error creating subscription plans', err);
    }
  };  
}

await createSubscriptions();