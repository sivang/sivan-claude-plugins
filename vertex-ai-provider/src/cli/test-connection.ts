#!/usr/bin/env node
import { loadConfig } from '../config';

async function main() {
  const config = loadConfig();

  if (!config.gcp.projectId) {
    console.error('❌ No configuration found. Run /vertex setup first.');
    process.exit(1);
  }

  console.log('🔍 Testing Vertex AI connection...');
  console.log(`   Project: ${config.gcp.projectId}`);
  console.log(`   Region:  ${config.gcp.region}`);
  console.log(`   Auth:    ${config.auth.method}`);

  try {
    const { GoogleAuth } = await import('google-auth-library');

    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    };

    if (config.auth.method === 'service-account' && config.auth.serviceAccountPath) {
      authOptions.keyFilename = config.auth.serviceAccountPath;
    }

    const auth = new GoogleAuth(authOptions);
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (token.token) {
      console.log('\n✅ Authentication successful!');
      console.log('   You can now use /vertex to activate Vertex AI.');
    } else {
      throw new Error('No access token received');
    }
  } catch (error: any) {
    console.error('\n❌ Authentication failed!');
    console.error(`   Error: ${error.message}`);

    if (config.auth.method === 'adc') {
      console.log('\n💡 Try running: gcloud auth application-default login');
    } else {
      console.log('\n💡 Check your service account key file path');
    }

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
