const DB_NAME = "phoneAfriend_db";
const DB_VERSION = 1;
const STORE = "people";

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function tx(db, mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
}

export async function getAllPeople() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const store = tx(db, "readonly");
        const req =store.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
    });
}

export async function upsertPerson(person) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const store = tx(db, "readwrite");
        const req = store.put(person);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

export async function deletePerson(id) {
    const db= await openDB();
    return new Promise((resolve, reject) => {
        const store = tx(db, "readwrite");
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

export async function replaceAllPeople(people) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        const store = transaction.objectStore(STORE);

        const clearReq = store.clear();
        clearReq.onerror = () => reject(clearReq.error);

        clearReq.onsuccess = () => {
            for (const p of people) store.put(p);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        };
    });
}