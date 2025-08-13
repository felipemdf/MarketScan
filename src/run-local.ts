// run-local.ts
import { handler } from "./index";

const event = { 
  source: "aws.events", 
  "detail-type": "Scheduled Event",
  time: new Date().toISOString(),
  region: "sa-east-1"
};

const context = { 
  awsRequestId: "local-test-" + Date.now(), 
  functionName: "marketscan-local",
  getRemainingTimeInMillis: () => 900000 // 15 minutos
} as any;

console.log('🚀 Starting local execution...');

handler(event, context, (error: any, result: any) => {
  if (error) {
    console.error('❌ Execution failed:');
    console.error(error);
    process.exit(1);
  } else {
    console.log('✅ Execution completed successfully:');
    console.log(JSON.stringify(result, null, 2));
  }
});