import React, { useState, useEffect } from 'react';
import { auth, db, loginWithGoogle, logout } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, deleteDoc 
} from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null); 
  const [categories, setCategories] = useState([]); 
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCatId, setEditCatId] = useState(null);
  const [editBudgetValue, setEditBudgetValue] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) { setCategories([]); setExpenses([]); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const qCats = query(collection(db, "categories"), where("uid", "==", user.uid));
      const unsubCats = onSnapshot(qCats, (snapshot) => {
        const fetchedCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // AUTO-SEEDER: If you have no envelopes, create the 5 permanent ones automatically
        if (fetchedCats.length === 0) {
          const defaults = ['Food', 'Transport', 'Shopping', 'Subscriptions', 'Housing'];
          defaults.forEach(async (catName) => {
            await addDoc(collection(db, "categories"), {
              uid: user.uid, name: catName, budget: 200, createdAt: serverTimestamp()
            });
          });
        } else {
          setCategories(fetchedCats);
        }
      });

      const qExps = query(collection(db, "expenses"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
      const unsubExps = onSnapshot(qExps, (snapshot) => {
        setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return () => { unsubCats(); unsubExps(); };
    }
  }, [user]); 

  // --- AI PREDICTION ---
  const handleNoteChange = async (text) => {
    setNote(text);
    if (text.length < 3) return; 

    try {
      const response = await fetch(`http://127.0.0.1:8000/predict?description=${text}`);
      const data = await response.json();
      
      const found = categories.find(c => c.name.toLowerCase() === data.category.toLowerCase());
      if (found) setSelectedCategory(found.id);
    } catch (err) {
      // API asleep
    }
  };

  // --- ADD EXPENSE & TEACH AI ---
  const handleAddExpense = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return alert("Invalid amount");
    if (!selectedCategory) return alert("Please select a category");

    const catObj = categories.find(c => c.id === selectedCategory);

    // 1. Save to Firebase
    await addDoc(collection(db, "expenses"), {
      uid: user.uid,
      categoryId: selectedCategory,
      amount: value,
      note: note,
      createdAt: serverTimestamp()
    });
    
    // 2. TEACH THE AI
    try {
      await fetch(`http://127.0.0.1:8000/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: note, category: catObj.name })
      });
    } catch (err) {
      console.log("Failed to teach AI");
    }

    setAmount('');
    setNote('');
  };

  const handleClearHistory = async () => {
    if (window.confirm("DANGER: Delete ALL past expenses?")) {
      for (const expense of expenses) await deleteDoc(doc(db, "expenses", expense.id));
    }
  };

  const openEditModal = (category) => {
    setEditCatId(category.id);
    setEditBudgetValue(category.budget);
    setIsEditModalOpen(true);
  };

  const saveEditedBudget = async () => {
    if (!editBudgetValue || isNaN(editBudgetValue)) return alert("Enter a valid number");
    await updateDoc(doc(db, "categories", editCatId), { budget: parseFloat(editBudgetValue) });
    setIsEditModalOpen(false);
  };

  const totalBudget = categories.reduce((acc, cat) => acc + cat.budget, 0);
  const totalSpent = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const isTotalExceeded = totalSpent > totalBudget;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: "450px", margin: "0 auto", padding: "20px" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>Paisa AI</h1>
          <p style={{ margin: "2px 0 0", color: "#7f8c8d", fontSize: "0.9rem", fontWeight: "bold" }}>Budgeting made Simple</p>
        </div>
        {user ? (
          <button onClick={logout} style={{ background: "#e74c3c", color: "white", border: "none", padding: "8px 15px", borderRadius: "8px", cursor: "pointer" }}>Logout</button>
        ) : (
          <button onClick={loginWithGoogle} style={{ background: "#4285F4", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Login</button>
        )}
      </header>

      {!user ? (
        <div style={{ textAlign: "center", marginTop: "60px", padding: "40px", background: "#f8f9fa", borderRadius: "12px" }}>
          <h2 style={{ margin: "0 0 10px 0", color: "#2c3e50" }}>Welcome to Paisa AI</h2>
          <p style={{ margin: 0, color: "#7f8c8d" }}>Log in to sync your smart wallet.</p>
        </div>
      ) : (
        <>
          {/* TOTAL SUMMARY BOX */}
          <div style={{ background: isTotalExceeded ? "#c0392b" : "#1a1a1a", color: "white", padding: "20px", borderRadius: "16px", marginBottom: "20px", transition: "background 0.3s ease" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", opacity: 0.8, textTransform: "uppercase", color: "white" }}>Total Monthly Budget</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: "2.5rem", color: "white" }}>${totalSpent.toFixed(2)}</h2>
              <span style={{ fontSize: "1.2rem", opacity: 0.8, color: "white" }}>/ ${totalBudget.toFixed(2)}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", height: "8px", borderRadius: "4px", marginTop: "15px", overflow: "hidden" }}>
              <div style={{ width: `${Math.min((totalSpent / (totalBudget || 1)) * 100, 100)}%`, background: "white", height: "100%", borderRadius: "4px" }}></div>
            </div>
          </div>

          {/* TABS (Dark Mode Proofed) */}
          <div style={{ display: "flex", marginBottom: "20px", background: "#f1f2f6", borderRadius: "10px", padding: "5px" }}>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              style={{ flex: 1, padding: "10px", border: "none", borderRadius: "8px", background: activeTab === 'dashboard' ? 'white' : 'transparent', color: activeTab === 'dashboard' ? '#2c3e50' : '#7f8c8d', fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal', cursor: "pointer", transition: "all 0.2s" }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              style={{ flex: 1, padding: "10px", border: "none", borderRadius: "8px", background: activeTab === 'history' ? 'white' : 'transparent', color: activeTab === 'history' ? '#2c3e50' : '#7f8c8d', fontWeight: activeTab === 'history' ? 'bold' : 'normal', cursor: "pointer", transition: "all 0.2s" }}
            >
              History
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <div>
              {categories.length > 0 && (
                <div style={{ background: "white", padding: "20px", borderRadius: "16px", marginBottom: "20px", border: "1px solid #e1e8ed" }}>
                  <h3 style={{marginTop: 0, color: "#2980b9", display: "flex", justifyContent: "space-between"}}>Input Spending <span style={{fontSize: "0.7rem", background: "#e8f4f8", padding: "3px 8px", borderRadius: "10px"}}>AI Active 🤖</span></h3>
                  <input type="text" placeholder="Expense Note (e.g., Cake)" value={note} onChange={(e) => handleNoteChange(e.target.value)} style={{ padding: "12px", width: "100%", boxSizing: "border-box", marginBottom: "10px", borderRadius: "8px", border: "1px solid #dcdde1" }} />
                  <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ padding: "12px", flex: 1, borderRadius: "8px", border: "1px solid #dcdde1" }}>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" placeholder="$0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ padding: "12px", width: "90px", borderRadius: "8px", border: "1px solid #dcdde1" }} />
                  </div>
                  <button onClick={handleAddExpense} style={{ width: "100%", padding: "12px", background: "#3498db", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Add Expense</button>
                </div>
              )}

              <h3 style={{ marginBottom: "15px" }}>My Wallets</h3>
              {categories.map(cat => {
                const catSpent = expenses.filter(e => e.categoryId === cat.id).reduce((sum, e) => sum + e.amount, 0);
                const percent = Math.min((catSpent / cat.budget) * 100, 100);
                const isExceeded = catSpent > cat.budget;

                return (
                  <div key={cat.id} style={{ background: "white", padding: "15px", borderRadius: "12px", marginBottom: "15px", border: "1px solid #e1e8ed" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#2c3e50" }}>{cat.name}</span>
                      <button onClick={() => openEditModal(cat)} style={{ border: "none", background: "none", color: "#f39c12", cursor: "pointer", fontSize: "0.9rem" }}>✏️ Edit Limit</button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#7f8c8d", marginBottom: "8px" }}>
                      <span>${catSpent.toFixed(2)} spent</span>
                      <span>${cat.budget.toFixed(2)} limit</span>
                    </div>
                    <div style={{ background: "#ecf0f1", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
                      <div style={{ width: `${percent}%`, background: isExceeded ? "#e74c3c" : "#2ecc71", height: "100%", transition: "width 0.3s ease, background 0.3s ease" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ background: "white", padding: "20px", borderRadius: "16px", border: "1px solid #e1e8ed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, color: "#2c3e50" }}>Past Expenses</h3>
                <button onClick={handleClearHistory} style={{ background: "#ffecec", color: "#e74c3c", border: "1px solid #e74c3c", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Clear</button>
              </div>
              {expenses.length === 0 ? <p style={{ textAlign: "center", color: "#95a5a6" }}>No expenses yet.</p> : expenses.map(exp => (
                <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f2f6" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#2c3e50" }}>{exp.note || "No note"}</div>
                    <div style={{ fontSize: "0.8rem", color: "#7f8c8d" }}>{categories.find(c => c.id === exp.categoryId)?.name || "Deleted"} • {exp.createdAt?.toDate ? exp.createdAt.toDate().toLocaleDateString() : 'Just now'}</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "#e74c3c" }}>-${exp.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isEditModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: "25px", borderRadius: "16px", width: "80%", maxWidth: "350px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#2c3e50" }}>Edit Monthly Limit</h3>
            <input type="number" value={editBudgetValue} onChange={(e) => setEditBudgetValue(e.target.value)} style={{ width: "100%", padding: "12px", boxSizing: "border-box", marginBottom: "20px", borderRadius: "8px", border: "2px solid #3498db" }} />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setIsEditModalOpen(false)} style={{ flex: 1, padding: "10px", background: "#ecf0f1", color: "#7f8c8d", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEditedBudget} style={{ flex: 1, padding: "10px", background: "#3498db", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;