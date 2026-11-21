#!/usr/bin/env node

/**
 * Initial Administrator Bootstrap Script for The Lane4 Performance Store
 * Usage: node src/scripts/createInitialAdmin.js [email] [password]
 */

const { getAuth, getDb } = require('../config/firebaseAdmin');
const { config } = require('../config/environment');

async function createAdmin() {
  const email = process.argv[2] || config.adminBootstrap.email;
  const password = process.argv[3] || config.adminBootstrap.password;

  console.log(`\n--- LANE4 INITIAL ADMIN BOOTSTRAP ---`);
  console.log(`Target Email: ${email}`);

  const auth = getAuth();
  const db = getDb();

  if (!auth || !db) {
    console.error('ERROR: Firebase Auth or Firestore is not available.');
    process.exit(1);
  }

  try {
    let uid;
    try {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
      console.log(`User already exists in Firebase Auth with UID: ${uid}`);
    } catch (e) {
      const newUser = await auth.createUser({
        email,
        password,
        displayName: 'LANE4 Chief Administrator',
        emailVerified: true
      });
      uid = newUser.uid;
      console.log(`Created new Firebase Auth user with UID: ${uid}`);
    }

    // Set custom claims: super_admin
    await auth.setCustomUserClaims(uid, {
      role: 'super_admin',
      permissions: [
        'dashboard:read',
        'orders:read',
        'orders:write',
        'payments:read',
        'payments:verify',
        'products:read',
        'products:write',
        'products:delete',
        'inventory:read',
        'inventory:write',
        'categories:write',
        'coupons:write',
        'customers:read',
        'settings:write',
        'reviews:write',
        'enquiries:read',
        'super_admin'
      ]
    });
    console.log(`Custom claims set: role = super_admin`);

    // Write to Firestore adminUsers collection
    await db.collection('adminUsers').doc(uid).set({
      uid,
      email,
      displayName: 'LANE4 Chief Administrator',
      role: 'super_admin',
      permissions: [
        'dashboard:read',
        'orders:read',
        'orders:write',
        'payments:read',
        'payments:verify',
        'products:read',
        'products:write',
        'products:delete',
        'inventory:read',
        'inventory:write',
        'categories:write',
        'coupons:write',
        'customers:read',
        'settings:write',
        'reviews:write',
        'enquiries:read',
        'super_admin'
      ],
      isActive: true,
      updatedAt: new Date()
    }, { merge: true });

    console.log(`SUCCESS: Administrator document registered in 'adminUsers' collection.`);
    console.log(`You can now sign in at http://localhost:${config.port}/admin/`);
    process.exit(0);
  } catch (err) {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

createAdmin();

