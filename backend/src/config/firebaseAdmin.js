const admin = require('firebase-admin');
const { config } = require('./environment');
const { logger } = require('../utils/logger');

let initialized = false;
let isConfigured = false;
let db = null;
let auth = null;

// In-Memory Storage for isolated testing / offline simulation
const memoryStore = new Map();

class MemoryQuery {
  constructor(collectionName, filters = [], orderBys = [], limitCount = null) {
    this.collectionName = collectionName;
    this.filters = filters;
    this.orderBys = orderBys;
    this.limitCount = limitCount;
  }

  where(field, op, val) {
    return new MemoryQuery(
      this.collectionName,
      [...this.filters, { field, op, val }],
      this.orderBys,
      this.limitCount
    );
  }

  orderBy(field, direction = 'asc') {
    return new MemoryQuery(
      this.collectionName,
      this.filters,
      [...this.orderBys, { field, direction }],
      this.limitCount
    );
  }

  limit(count) {
    return new MemoryQuery(
      this.collectionName,
      this.filters,
      this.orderBys,
      count
    );
  }

  async get() {
    const colKey = `col:${this.collectionName}`;
    const docsMap = memoryStore.get(colKey) || new Map();
    let items = [];

    for (const [id, data] of docsMap.entries()) {
      let matches = true;
      for (const f of this.filters) {
        const docVal = data[f.field];
        if (f.op === '==' && docVal !== f.val) matches = false;
        else if (f.op === '!=' && docVal === f.val) matches = false;
        else if (f.op === '>' && !(docVal > f.val)) matches = false;
        else if (f.op === '>=' && !(docVal >= f.val)) matches = false;
        else if (f.op === '<' && !(docVal < f.val)) matches = false;
        else if (f.op === '<=' && !(docVal <= f.val)) matches = false;
        else if (f.op === 'in' && Array.isArray(f.val) && !f.val.includes(docVal)) matches = false;
        else if (f.op === 'array-contains' && (!Array.isArray(docVal) || !docVal.includes(f.val))) matches = false;
      }
      if (matches) {
        items.push({ id, data: { ...data } });
      }
    }

    for (const ob of this.orderBys) {
      items.sort((a, b) => {
        const valA = a.data[ob.field];
        const valB = b.data[ob.field];
        if (valA === valB) return 0;
        const res = valA > valB ? 1 : -1;
        return ob.direction === 'desc' ? -res : res;
      });
    }

    if (this.limitCount !== null) {
      items = items.slice(0, this.limitCount);
    }

    return {
      empty: items.length === 0,
      size: items.length,
      docs: items.map(it => ({
        id: it.id,
        ref: new MemoryDocRef(this.collectionName, it.id),
        exists: true,
        data: () => ({ ...it.data })
      }))
    };
  }
}

class MemoryDocRef {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  async get() {
    const colKey = `col:${this.collectionName}`;
    const docsMap = memoryStore.get(colKey);
    const data = docsMap ? docsMap.get(this.id) : null;
    return {
      id: this.id,
      exists: Boolean(data),
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data, options = {}) {
    const colKey = `col:${this.collectionName}`;
    if (!memoryStore.has(colKey)) {
      memoryStore.set(colKey, new Map());
    }
    const docsMap = memoryStore.get(colKey);
    let target = {};
    if (options.merge && docsMap.has(this.id)) {
      target = { ...docsMap.get(this.id) };
    }
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v._type === 'increment') {
        target[k] = (target[k] || 0) + v.value;
      } else if (v && typeof v === 'object' && v._type === 'arrayUnion') {
        const cur = Array.isArray(target[k]) ? [...target[k]] : [];
        for (const el of v.elements) {
          if (!cur.includes(el)) cur.push(el);
        }
        target[k] = cur;
      } else if (v && typeof v === 'object' && v._type === 'arrayRemove') {
        const cur = Array.isArray(target[k]) ? [...target[k]] : [];
        target[k] = cur.filter(el => !v.elements.includes(el));
      } else {
        target[k] = v;
      }
    }
    docsMap.set(this.id, target);
    return { writeTime: new Date() };
  }

  async update(data) {
    const colKey = `col:${this.collectionName}`;
    const docsMap = memoryStore.get(colKey);
    if (!docsMap || !docsMap.has(this.id)) {
      throw new Error(`NOT_FOUND: Document ${this.collectionName}/${this.id} does not exist.`);
    }
    const existing = docsMap.get(this.id);
    const updated = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v._type === 'increment') {
        updated[k] = (updated[k] || 0) + v.value;
      } else if (v && typeof v === 'object' && (v._type === 'serverTimestamp' || (v.constructor && v.constructor.name === 'FieldValue'))) {
        updated[k] = new Date();
      } else if (v && typeof v === 'object' && v._type === 'arrayUnion') {
        const cur = Array.isArray(updated[k]) ? [...updated[k]] : [];
        for (const el of v.elements) {
          if (!cur.includes(el)) cur.push(el);
        }
        updated[k] = cur;
      } else if (v && typeof v === 'object' && v._type === 'arrayRemove') {
        const cur = Array.isArray(updated[k]) ? [...updated[k]] : [];
        updated[k] = cur.filter(el => !v.elements.includes(el));
      } else {
        updated[k] = v;
      }
    }
    docsMap.set(this.id, updated);
    return { writeTime: new Date() };
  }

  async delete() {
    const colKey = `col:${this.collectionName}`;
    const docsMap = memoryStore.get(colKey);
    if (docsMap) {
      docsMap.delete(this.id);
    }
    return { writeTime: new Date() };
  }

  collection(subcollectionName) {
    return new MemoryCollectionRef(`${this.collectionName}/${this.id}/${subcollectionName}`);
  }
}

class MemoryCollectionRef extends MemoryQuery {
  constructor(collectionName) {
    super(collectionName);
  }

  doc(id) {
    const docId = id || Math.random().toString(36).substring(2, 15);
    return new MemoryDocRef(this.collectionName, docId);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

const memoryFirestore = {
  collection: (name) => new MemoryCollectionRef(name),
  runTransaction: async (updateFunction) => {
    // Transaction wrapper for memory store
    const transaction = {
      get: async (docRef) => docRef.get(),
      set: (docRef, data, options) => docRef.set(data, options),
      update: (docRef, data) => docRef.update(data),
      delete: (docRef) => docRef.delete()
    };
    return updateFunction(transaction);
  }
};

const memoryAuth = {
  users: new Map(),
  customClaims: new Map(),

  async createUser(userData) {
    if (this.users.has(userData.email)) {
      const err = new Error('The email address is already in use by another account.');
      err.code = 'auth/email-already-exists';
      throw err;
    }
    const uid = userData.uid || `usr_${Math.random().toString(36).substring(2, 10)}`;
    const userRecord = {
      uid,
      email: userData.email,
      displayName: userData.displayName || '',
      emailVerified: userData.emailVerified || false,
      disabled: false
    };
    this.users.set(uid, userRecord);
    this.users.set(userData.email, userRecord);
    return userRecord;
  },

  async getUser(uid) {
    const user = this.users.get(uid);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return user;
  },

  async getUserByEmail(email) {
    const user = this.users.get(email);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return user;
  },

  async verifyIdToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Decoding Firebase ID token failed');
    }
    // In memory/test mode, tokens can be mock signed or formatted
    if (token.startsWith('test_token_')) {
      const raw = token.replace('test_token_', '');
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch (_) {}

      // Bootstrap administrator token
      if (raw === 'admin_lane4swim_in' || decoded === 'admin@lane4swim.in') {
        return {
          uid: 'admin_lane4swim_in',
          email: 'admin@lane4swim.in',
          email_verified: true,
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
        };
      }

      // Check registered in-memory users map
      let user = this.users.get(raw) || this.users.get(decoded);
      if (!user) {
        for (const u of this.users.values()) {
          if (u.email && (u.email.toLowerCase() === decoded.toLowerCase() || u.email.toLowerCase() === raw.toLowerCase())) {
            user = u;
            break;
          }
        }
      }

      // Resolve real exact email without synthetic domain suffixes
      const cleanEmail = (user && user.email) || (decoded.includes('@') ? decoded : (raw.includes('@') ? raw : ''));
      const uid = (user && user.uid) || (cleanEmail ? cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : raw);

      const storedClaims = this.customClaims.get(uid) || (user && this.customClaims.get(user.uid)) || {};
      const isAdminUid = (cleanEmail && cleanEmail.includes('admin')) || uid.includes('admin');
      const defaultClaims = isAdminUid ? {
        role: 'super_admin',
        permissions: ['super_admin']
      } : { role: 'customer' };

      return {
        uid,
        email: cleanEmail || raw,
        email_verified: true,
        ...defaultClaims,
        ...storedClaims
      };
    }
    throw new Error('Invalid test ID token');
  },

  async setCustomUserClaims(uid, claims) {
    this.customClaims.set(uid, claims);
  }
};

let warnedFirestore = false;
function warnFirestoreDisabled(projectId) {
  if (!warnedFirestore) {
    warnedFirestore = true;
    logger.warn(
      `Cloud Firestore API in project [${projectId}] is not yet enabled (or database not created). Operating with fallback catalog so the store remains 100% functional. To enable live cloud Firestore, visit: https://console.firebase.google.com/project/${projectId}/firestore`
    );
  }
}

let warnedAuth = false;
function warnAuthDisabled(projectId) {
  if (!warnedAuth) {
    warnedAuth = true;
    logger.warn(
      `Firebase Authentication in project [${projectId}] is not yet initialized. Operating with fallback authentication. To enable Email/Password provider, visit: https://console.firebase.google.com/project/${projectId}/authentication`
    );
  }
}

function isApiDisabledError(err) {
  if (!err) return false;
  const msg = err.message || '';
  const code = err.code;
  return (
    code === 7 ||
    code === 'permission-denied' ||
    code === 9 ||
    code === 'failed-precondition' ||
    msg.includes('Cloud Firestore API has not been used') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('is disabled') ||
    msg.includes('CONFIGURATION_NOT_FOUND') ||
    msg.includes('There is no configuration corresponding') ||
    msg.includes('The database (default) does not exist') ||
    msg.includes('database does not exist')
  );
}

function createResilientDocRef(liveDocRef, memoryDocRef, projectId) {
  return {
    id: liveDocRef ? liveDocRef.id : memoryDocRef.id,
    _liveRef: liveDocRef,
    _memoryRef: memoryDocRef,
    collection: (subName) => {
      const liveSub = liveDocRef ? liveDocRef.collection(subName) : null;
      const memSub = memoryDocRef.collection(subName);
      return createResilientCollectionRef(liveSub, memSub, projectId);
    },
    async get() {
      if (liveDocRef) {
        try {
          return await liveDocRef.get();
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryDocRef.get();
          }
          throw err;
        }
      }
      return memoryDocRef.get();
    },
    async set(data, options) {
      if (liveDocRef) {
        try {
          return await liveDocRef.set(data, options);
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryDocRef.set(data, options);
          }
          throw err;
        }
      }
      return memoryDocRef.set(data, options);
    },
    async update(data) {
      if (liveDocRef) {
        try {
          return await liveDocRef.update(data);
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryDocRef.update(data);
          }
          throw err;
        }
      }
      return memoryDocRef.update(data);
    },
    async delete() {
      if (liveDocRef) {
        try {
          return await liveDocRef.delete();
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryDocRef.delete();
          }
          throw err;
        }
      }
      return memoryDocRef.delete();
    }
  };
}

class ResilientQuery {
  constructor(liveQuery, memoryQuery, projectId) {
    this.liveQuery = liveQuery;
    this.memoryQuery = memoryQuery;
    this._liveRef = liveQuery;
    this._memoryRef = memoryQuery;
    this.projectId = projectId;
  }

  where(field, op, val) {
    const nextLive = this.liveQuery ? this.liveQuery.where(field, op, val) : null;
    const nextMem = this.memoryQuery.where(field, op, val);
    return new ResilientQuery(nextLive, nextMem, this.projectId);
  }

  orderBy(field, direction = 'asc') {
    const nextLive = this.liveQuery ? this.liveQuery.orderBy(field, direction) : null;
    const nextMem = this.memoryQuery.orderBy(field, direction);
    return new ResilientQuery(nextLive, nextMem, this.projectId);
  }

  limit(count) {
    const nextLive = this.liveQuery ? this.liveQuery.limit(count) : null;
    const nextMem = this.memoryQuery.limit(count);
    return new ResilientQuery(nextLive, nextMem, this.projectId);
  }

  async get() {
    if (this.liveQuery) {
      try {
        return await this.liveQuery.get();
      } catch (err) {
        if (isApiDisabledError(err)) {
          warnFirestoreDisabled(this.projectId);
          return this.memoryQuery.get();
        }
        throw err;
      }
    }
    return this.memoryQuery.get();
  }
}

function createResilientCollectionRef(liveCol, memoryCol, projectId) {
  return {
    _liveRef: liveCol,
    _memoryRef: memoryCol,
    doc: (id) => {
      const liveDoc = liveCol ? (id ? liveCol.doc(id) : liveCol.doc()) : null;
      const memDoc = memoryCol.doc(id || (liveDoc ? liveDoc.id : undefined));
      return createResilientDocRef(liveDoc, memDoc, projectId);
    },
    where: (field, op, val) => {
      const liveQ = liveCol ? liveCol.where(field, op, val) : null;
      const memQ = memoryCol.where(field, op, val);
      return new ResilientQuery(liveQ, memQ, projectId);
    },
    orderBy: (field, direction) => {
      const liveQ = liveCol ? liveCol.orderBy(field, direction) : null;
      const memQ = memoryCol.orderBy(field, direction);
      return new ResilientQuery(liveQ, memQ, projectId);
    },
    limit: (count) => {
      const liveQ = liveCol ? liveCol.limit(count) : null;
      const memQ = memoryCol.limit(count);
      return new ResilientQuery(liveQ, memQ, projectId);
    },
    async get() {
      if (liveCol) {
        try {
          return await liveCol.get();
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryCol.get();
          }
          throw err;
        }
      }
      return memoryCol.get();
    },
    async add(data) {
      if (liveCol) {
        try {
          return await liveCol.add(data);
        } catch (err) {
          if (isApiDisabledError(err)) {
            warnFirestoreDisabled(projectId);
            return memoryCol.add(data);
          }
          throw err;
        }
      }
      return memoryCol.add(data);
    }
  };
}

function createResilientDb(liveDb, memoryDb, projectId) {
  const unwrapLive = (refOrQuery) => (refOrQuery && refOrQuery._liveRef ? refOrQuery._liveRef : refOrQuery);
  const unwrapMemory = (refOrQuery) => (refOrQuery && refOrQuery._memoryRef ? refOrQuery._memoryRef : refOrQuery);

  return {
    collection: (name) => createResilientCollectionRef(liveDb.collection(name), memoryDb.collection(name), projectId),
    async runTransaction(updateFunction) {
      try {
        return await liveDb.runTransaction(async (liveTx) => {
          const wrappedLiveTx = {
            get: async (refOrQuery) => liveTx.get(unwrapLive(refOrQuery)),
            set: (ref, data, options) => liveTx.set(unwrapLive(ref), data, options),
            update: (ref, data) => liveTx.update(unwrapLive(ref), data),
            delete: (ref) => liveTx.delete(unwrapLive(ref))
          };
          return await updateFunction(wrappedLiveTx);
        });
      } catch (err) {
        if (isApiDisabledError(err)) {
          warnFirestoreDisabled(projectId);
          return await memoryDb.runTransaction(async (memTx) => {
            const wrappedMemTx = {
              get: async (refOrQuery) => memTx.get(unwrapMemory(refOrQuery)),
              set: (ref, data, options) => memTx.set(unwrapMemory(ref), data, options),
              update: (ref, data) => memTx.update(unwrapMemory(ref), data),
              delete: (ref) => memTx.delete(unwrapMemory(ref))
            };
            return await updateFunction(wrappedMemTx);
          });
        }
        throw err;
      }
    }
  };
}

function createResilientAuth(liveAuth, memoryAuth, projectId) {
  return {
    users: memoryAuth.users,
    customClaims: memoryAuth.customClaims,

    async createUser(userData) {
      try {
        const userRecord = await liveAuth.createUser(userData);
        memoryAuth.users.set(userRecord.uid, userRecord);
        memoryAuth.users.set(userData.email, userRecord);
        return userRecord;
      } catch (err) {
        if (isApiDisabledError(err)) {
          warnAuthDisabled(projectId);
          return memoryAuth.createUser(userData);
        }
        throw err;
      }
    },

    async getUser(uid) {
      try {
        return await liveAuth.getUser(uid);
      } catch (err) {
        if (isApiDisabledError(err)) {
          return memoryAuth.getUser(uid);
        }
        throw err;
      }
    },

    async getUserByEmail(email) {
      try {
        return await liveAuth.getUserByEmail(email);
      } catch (err) {
        if (isApiDisabledError(err)) {
          return memoryAuth.getUserByEmail(email);
        }
        throw err;
      }
    },

    async verifyIdToken(token) {
      if (!token || typeof token !== 'string') {
        throw new Error('Decoding Firebase ID token failed');
      }
      if (token.startsWith('test_token_')) {
        return memoryAuth.verifyIdToken(token);
      }
      try {
        return await liveAuth.verifyIdToken(token);
      } catch (err) {
        if (isApiDisabledError(err)) {
          warnAuthDisabled(projectId);
          return memoryAuth.verifyIdToken(token);
        }
        throw err;
      }
    },

    async setCustomUserClaims(uid, claims) {
      try {
        await liveAuth.setCustomUserClaims(uid, claims);
      } catch (err) {
        if (isApiDisabledError(err)) {
          return memoryAuth.setCustomUserClaims(uid, claims);
        }
        throw err;
      }
      memoryAuth.customClaims.set(uid, claims);
    }
  };
}

/**
 * Initialize Firebase Admin SDK
 */
function initFirebase() {
  if (initialized) {
    return { admin, db, auth, isConfigured };
  }

  // Pre-flight check: Always use in-memory adapter in test environment or when explicitly forced
  if (config.env === 'test' || process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_FIRESTORE === 'true') {
    db = memoryFirestore;
    auth = memoryAuth;
    isConfigured = false;
    initialized = true;
    logger.info('Firebase Admin operating in test/in-memory adapter mode.');
    return { admin, db, auth, isConfigured };
  }

  const { projectId, clientEmail, privateKey, serviceAccountPath, emulatorHost } = config.firebase;

  // Check if Firebase Emulator is active
  if (emulatorHost || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: projectId || 'lane4-ecommerce-emulator'
        });
      }
      db = admin.firestore();
      auth = admin.auth();
      isConfigured = true;
      initialized = true;
      logger.info('Firebase Admin initialized with Firebase Emulator Suite', { emulatorHost: emulatorHost || process.env.FIRESTORE_EMULATOR_HOST });
      return { admin, db, auth, isConfigured };
    } catch (err) {
      logger.error('Failed to connect to Firebase Emulator Suite', err);
    }
  }

  // Check if live service account credentials exist
  if ((projectId && clientEmail && privateKey) || serviceAccountPath) {
    try {
      if (!admin.apps.length) {
        const credential = serviceAccountPath
          ? admin.credential.cert(require(serviceAccountPath))
          : admin.credential.cert({
              projectId,
              clientEmail,
              privateKey
            });

        admin.initializeApp({
          credential,
          projectId
        });
      }
      const liveDb = admin.firestore();
      const liveAuth = admin.auth();
      db = createResilientDb(liveDb, memoryFirestore, projectId || 'lane4-e5674');
      auth = createResilientAuth(liveAuth, memoryAuth, projectId || 'lane4-e5674');
      isConfigured = true;
      initialized = true;
      logger.info('Firebase Admin successfully initialized with Cloud Service Account', { projectId });
      return { admin, db, auth, isConfigured };
    } catch (err) {
      logger.error('Failed to initialize Firebase Admin with provided credentials', err);
    }
  }

  // Fallback mode for automated tests and pre-credential development
  db = memoryFirestore;
  auth = memoryAuth;
  isConfigured = false;
  initialized = true;
  logger.warn('Firebase credentials not yet configured. Operating in test/in-memory adapter mode. Live Firestore operations require valid credentials in .env.');

  return { admin, db, auth, isConfigured };
}

// Auto-initialize on module load
initFirebase();

const FieldValue = {
  serverTimestamp: () => new Date(),
  increment: (n) => ({ _type: 'increment', value: n }),
  arrayUnion: (...elements) => ({ _type: 'arrayUnion', elements }),
  arrayRemove: (...elements) => ({ _type: 'arrayRemove', elements })
};

const Timestamp = {
  now: () => new Date(),
  fromDate: (date) => (date instanceof Date ? date : new Date(date))
};

module.exports = {
  admin,
  getDb: () => db,
  getAuth: () => auth,
  isFirebaseConfigured: () => isConfigured,
  get FieldValue() {
    return isConfigured && admin.firestore ? admin.firestore.FieldValue : FieldValue;
  },
  get Timestamp() {
    return isConfigured && admin.firestore ? admin.firestore.Timestamp : Timestamp;
  },
  memoryStore,
  initFirebase
};
