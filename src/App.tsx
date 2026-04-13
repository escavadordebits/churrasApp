import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  getDoc,
  Timestamp,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  LogOut, 
  LogIn,
  Beef,
  Beer,
  Trash2,
  Mail,
  Phone,
  History,
  Pencil,
  FileText,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface CostItem {
  id: string;
  description: string;
  value: number;
  isReservation?: boolean;
}

interface Receipt {
  id: string;
  url: string;
  description: string;
  uploadedAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: 'Churrasqueiro' | 'Garçom';
  phone?: string;
}

interface BBQ {
  id: string;
  date: string;
  location: string;
  address: string;
  pixKey: string;
  totalCost: number;
  costs: CostItem[];
  receipts: Receipt[];
  status: 'planned' | 'completed' | 'cancelled';
  allowGuests: boolean;
  staff: StaffMember[];
  itemLimits: { [itemName: string]: number };
  createdAt: string;
  createdBy: string;
}

interface Participant {
  id: string;
  bbqId: string;
  name: string;
  email: string;
  phone: string;
  itemToBring: string;
  guestCount: number;
  paid: boolean;
  confirmedAt: string;
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we'd show a toast or alert
}

// --- Components ---

const Navbar = ({ user }: { user: User | null }) => {
  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-orange-600 p-2 rounded-lg">
              <Beef className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">Gestor de Churrasco</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {user.email === 'sapemailb1@gmail.com' && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-red-200">
                    Admin
                  </span>
                )}
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-gray-200" />
                <button 
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-full font-medium hover:bg-orange-700 transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const BBQCard: React.FC<{ bbq: BBQ }> = ({ bbq }) => {
  return (
    <Link 
      to={`/bbq/${bbq.id}`}
      className="group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
          {bbq.status === 'planned' ? 'Planejado' : 'Finalizado'}
        </div>
        <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
        {format(new Date(bbq.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
      </h3>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{bbq.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{format(new Date(bbq.date), "HH:mm")}</span>
        </div>
      </div>
    </Link>
  );
};

const Home = ({ user }: { user: User | null }) => {
  const [bbqs, setBbqs] = useState<BBQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'bbqs'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BBQ));
      setBbqs(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bbqs');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const upcoming = bbqs.filter(b => new Date(b.date) >= new Date() && b.status === 'planned');
  const past = bbqs.filter(b => new Date(b.date) < new Date() || b.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Próximos Churrascos</h1>
          <p className="text-gray-500 mt-1">Organize e participe dos eventos do condomínio.</p>
        </div>
        {user && (
          <Link 
            to="/new"
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-700 transition-all shadow-lg hover:shadow-orange-200"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Churrasco</span>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="space-y-12">
          <section>
            {upcoming.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcoming.map((bbq: BBQ) => <BBQCard key={bbq.id} bbq={bbq} />)}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Nenhum churrasco planejado</h3>
                <p className="text-gray-500 mt-2">Que tal organizar o próximo?</p>
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-bold text-gray-900">Histórico</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                {past.map((bbq: BBQ) => <BBQCard key={bbq.id} bbq={bbq} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const STANDARD_ITEMS = [
  'Carne (Picanha/Alcatra)',
  'Carne (Contra-filé/Maminha)',
  'Linguiça',
  'Frango (Sobrecoxa/Asinha)',
  'Pão de Alho',
  'Queijo Coalho',
  'Cerveja (Pack)',
  'Refrigerante (2L)',
  'Suco',
  'Carvão',
  'Gelo'
];

const NewBBQ = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    location: '',
    address: '',
    pixKey: '',
    allowGuests: true
  });
  const [costs, setCosts] = useState<CostItem[]>([
    { id: '1', description: 'Reserva da Churrasqueira', value: 0, isReservation: true }
  ]);
  const [itemLimits, setItemLimits] = useState<{ [key: string]: number }>({});

  const addCost = () => {
    setCosts([...costs, { id: Math.random().toString(36).substr(2, 9), description: '', value: 0 }]);
  };

  const removeCost = (id: string) => {
    if (costs.length > 1) {
      setCosts(costs.filter(c => c.id !== id));
    }
  };

  const updateCost = (id: string, field: keyof CostItem, value: any) => {
    setCosts(costs.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const totalCost = costs.reduce((acc, curr) => acc + Number(curr.value), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      await addDoc(collection(db, 'bbqs'), {
        date: dateTime.toISOString(),
        location: formData.location,
        address: formData.address,
        pixKey: formData.pixKey,
        allowGuests: formData.allowGuests,
        itemLimits: itemLimits,
        totalCost: totalCost,
        costs: costs,
        staff: [],
        receipts: [],
        status: 'planned',
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bbqs');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Organizar Novo Churrasco</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Data</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Hora</label>
              <input 
                type="time" 
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Local da Churrasqueira</label>
            <input 
              type="text" 
              placeholder="Ex: Área Gourmet Bloco A"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Endereço do Condomínio</label>
            <input 
              type="text" 
              placeholder="Rua Exemplo, 123"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Chave PIX para Pagamento</label>
            <input 
              type="text" 
              placeholder="E-mail, CPF ou Celular"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              value={formData.pixKey}
              onChange={e => setFormData({...formData, pixKey: e.target.value})}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-gray-900">Permitir Convidados</label>
              <p className="text-xs text-gray-500">Participantes podem levar acompanhantes</p>
            </div>
            <button 
              type="button"
              onClick={() => setFormData({...formData, allowGuests: !formData.allowGuests})}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                formData.allowGuests ? "bg-orange-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                formData.allowGuests ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-700">Limites de Itens (Opcional)</label>
            <p className="text-xs text-gray-500 mb-3">Defina o máximo de pessoas que podem levar cada item. Deixe em branco para ilimitado.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STANDARD_ITEMS.map(item => (
                <div key={item} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-medium text-gray-700 flex-1 truncate">{item}</span>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="∞"
                    className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    value={itemLimits[item] || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      const newLimits = { ...itemLimits };
                      if (isNaN(val) || val <= 0) {
                        delete newLimits[item];
                      } else {
                        newLimits[item] = val;
                      }
                      setItemLimits(newLimits);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700">Detalhamento de Custos</label>
              <button 
                type="button"
                onClick={addCost}
                className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:text-orange-700"
              >
                <Plus className="w-4 h-4" /> Adicionar Custo
              </button>
            </div>
            
            <div className="space-y-3">
              {costs.map((cost) => (
                <div key={cost.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="Descrição (ex: Carvão, Gelo...)"
                      required
                      disabled={cost.isReservation}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm disabled:bg-gray-50"
                      value={cost.description}
                      onChange={e => updateCost(cost.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="w-32 relative">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">R$</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      required
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      value={cost.value || ''}
                      onChange={e => updateCost(cost.id, 'value', e.target.value)}
                    />
                  </div>
                  {!cost.isReservation && (
                    <button 
                      type="button"
                      onClick={() => removeCost(cost.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-orange-50 rounded-2xl flex justify-between items-center">
              <span className="font-bold text-orange-900">Total Previsto</span>
              <span className="text-xl font-extrabold text-orange-600">R$ {totalCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 italic">
              * O valor da reserva da churrasqueira geralmente é pago antecipadamente pelo organizador.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
            >
              Criar Evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BBQDetail = ({ user }: { user: User | null }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bbq, setBbq] = useState<BBQ | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showEditBbqForm, setShowEditBbqForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [allBbqs, setAllBbqs] = useState<BBQ[]>([]);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffData, setStaffData] = useState({ name: '', role: 'Churrasqueiro' as 'Churrasqueiro' | 'Garçom', phone: '' });
  const [costData, setCostData] = useState({ description: '', value: 0, isReservation: false });
  const [receiptData, setReceiptData] = useState({ url: '', description: '' });
  const [joinData, setJoinData] = useState({
    name: '',
    email: '',
    phone: '',
    items: [] as string[],
    customItem: '',
    guestCount: 0
  });

  const standardItems = [
    'Carne (Picanha/Alcatra)',
    'Carne (Contra-filé/Maminha)',
    'Linguiça',
    'Frango (Sobrecoxa/Asinha)',
    'Pão de Alho',
    'Queijo Coalho',
    'Cerveja (Pack)',
    'Refrigerante (2L)',
    'Suco',
    'Carvão',
    'Gelo'
  ];

  useEffect(() => {
    if (!id) return;
    
    const bbqRef = doc(db, 'bbqs', id);
    const unsubscribeBbq = onSnapshot(bbqRef, (doc) => {
      if (doc.exists()) {
        setBbq({ id: doc.id, ...doc.data() } as BBQ);
      } else {
        navigate('/');
      }
    });

    const participantsRef = collection(db, 'bbqs', id, 'participants');
    const unsubscribeParticipants = onSnapshot(participantsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
      setParticipants(list);
    });

    // Fetch all BBQs for import functionality
    const q = query(collection(db, 'bbqs'), orderBy('date', 'asc'));
    const unsubscribeAllBbqs = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BBQ));
      setAllBbqs(list.filter(b => b.id !== id));
    });

    return () => {
      unsubscribeBbq();
      unsubscribeParticipants();
      unsubscribeAllBbqs();
    };
  }, [id, navigate]);

  const handleUpdateBbq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      const dateTime = new Date(`${bbqForm.date}T${bbqForm.time}`);
      await updateDoc(bbqRef, {
        date: dateTime.toISOString(),
        location: bbqForm.location,
        address: bbqForm.address,
        pixKey: bbqForm.pixKey,
        allowGuests: bbqForm.allowGuests,
        itemLimits: bbqForm.itemLimits
      });
      setShowEditBbqForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  const handleDeleteBbq = async () => {
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;
    if (!confirm('Tem certeza que deseja excluir este churrasco? Todos os dados serão perdidos.')) return;

    try {
      // Delete participants first
      const pSnapshot = await getDocs(collection(db, 'bbqs', id, 'participants'));
      const deletePromises = pSnapshot.docs.map(d => deleteDoc(doc(db, 'bbqs', id, 'participants', d.id)));
      await Promise.all(deletePromises);

      // Delete BBQ
      await deleteDoc(doc(db, 'bbqs', id));
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bbqs/${id}`);
    }
  };

  const handleImportParticipants = async (sourceBbqId: string) => {
    if (!id) return;
    try {
      const sourceRef = collection(db, 'bbqs', sourceBbqId, 'participants');
      const snapshot = await getDocs(sourceRef);
      
      const importPromises = snapshot.docs.map(d => {
        const data = d.data();
        return addDoc(collection(db, 'bbqs', id, 'participants'), {
          ...data,
          bbqId: id,
          paid: false,
          confirmedAt: new Date().toISOString()
        });
      });

      await Promise.all(importPromises);
      setShowImportModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `bbqs/${id}/participants/import`);
    }
  };

  const [bbqForm, setBbqForm] = useState({
    date: '',
    time: '',
    location: '',
    address: '',
    pixKey: '',
    allowGuests: true,
    itemLimits: {} as { [key: string]: number }
  });

  useEffect(() => {
    if (bbq) {
      const date = new Date(bbq.date);
      setBbqForm({
        date: format(date, 'yyyy-MM-dd'),
        time: format(date, 'HH:mm'),
        location: bbq.location,
        address: bbq.address,
        pixKey: bbq.pixKey,
        allowGuests: bbq.allowGuests ?? true,
        itemLimits: bbq.itemLimits || {}
      });
    }
  }, [bbq]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const finalItems = [...joinData.items];
    if (joinData.customItem.trim()) {
      finalItems.push(joinData.customItem.trim());
    }

    const itemToBring = finalItems.length > 0 ? finalItems.join(', ') : 'Nenhum item selecionado';

    try {
      if (editingParticipant) {
        const pRef = doc(db, 'bbqs', id, 'participants', editingParticipant.id);
        await updateDoc(pRef, {
          name: joinData.name,
          email: joinData.email,
          phone: joinData.phone,
          itemToBring,
          guestCount: joinData.guestCount
        });
        setEditingParticipant(null);
      } else {
        await addDoc(collection(db, 'bbqs', id, 'participants'), {
          name: joinData.name,
          email: joinData.email,
          phone: joinData.phone,
          itemToBring,
          guestCount: joinData.guestCount,
          bbqId: id,
          paid: false,
          confirmedAt: new Date().toISOString()
        });
        
        // Send confirmation email via backend if email is provided
        if (joinData.email) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: joinData.email,
              subject: 'Confirmação de Churrasco!',
              text: `Olá ${joinData.name}, sua presença no churrasco do dia ${format(new Date(bbq!.date), 'dd/MM')} foi confirmada!`,
              html: `<h1>Confirmação de Presença</h1><p>Olá <strong>${joinData.name}</strong>,</p><p>Sua presença no churrasco está confirmada!</p><p><strong>Local:</strong> ${bbq?.location}</p><p><strong>Itens que você levará:</strong> ${itemToBring}</p><p><strong>Chave PIX para rateio:</strong> ${bbq?.pixKey}</p>`
            })
          });
        }
      }

      setJoinData({ name: '', email: '', phone: '', items: [], customItem: '', guestCount: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `bbqs/${id}/participants`);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      const newStaff: StaffMember = {
        id: Math.random().toString(36).substr(2, 9),
        ...staffData
      };
      
      await updateDoc(bbqRef, {
        staff: [...(bbq.staff || []), newStaff]
      });
      
      setShowStaffForm(false);
      setStaffData({ name: '', role: 'Churrasqueiro', phone: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      const updatedStaff = bbq.staff.filter(s => s.id !== staffId);
      await updateDoc(bbqRef, { staff: updatedStaff });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  const handleEdit = (p: Participant) => {
    setEditingParticipant(p);
    setShowJoinForm(true);
    // Try to split items back into array and custom
    const itemsList = p.itemToBring.split(', ');
    const standard = itemsList.filter(i => STANDARD_ITEMS.includes(i));
    const custom = itemsList.filter(i => !STANDARD_ITEMS.includes(i)).join(', ');
    
    setJoinData({
      name: p.name,
      email: p.email,
      phone: p.phone,
      items: standard,
      customItem: custom,
      guestCount: p.guestCount || 0
    });
  };

  const handleDelete = async (participantId: string) => {
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;
    
    try {
      const pRef = doc(db, 'bbqs', id, 'participants', participantId);
      await deleteDoc(pRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bbqs/${id}/participants/${participantId}`);
      alert('Erro ao excluir participante. Verifique as permissões.');
    }
  };

  const togglePaid = async (participantId: string, currentStatus: boolean) => {
    const isAdmin = user?.email === 'sapemailb1@gmail.com';
    const isCreator = user?.uid === bbq?.createdBy;
    
    if (!user || !id || (!isAdmin && !isCreator)) return;
    
    try {
      const pRef = doc(db, 'bbqs', id, 'participants', participantId);
      await updateDoc(pRef, { paid: !currentStatus });
      
      if (!currentStatus) {
        // Find participant email
        const p = participants.find(p => p.id === participantId);
        if (p) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: p.email,
              subject: 'Pagamento Confirmado!',
              text: `Olá ${p.name}, seu pagamento para o churrasco foi confirmado!`,
              html: `<h1>Pagamento Confirmado</h1><p>Olá <strong>${p.name}</strong>,</p><p>Seu pagamento para o churrasco do dia ${format(new Date(bbq!.date), 'dd/MM')} foi recebido com sucesso. Nos vemos lá!</p>`
            })
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}/participants/${participantId}`);
    }
  };

  const handleAddReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      const newReceipt: Receipt = {
        id: Math.random().toString(36).substr(2, 9),
        url: receiptData.url,
        description: receiptData.description,
        uploadedAt: new Date().toISOString()
      };
      
      await updateDoc(bbqRef, {
        receipts: [...(bbq.receipts || []), newReceipt]
      });
      
      setShowReceiptForm(false);
      setReceiptData({ url: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      let updatedCosts = [...(bbq.costs || [])];

      if (editingCost) {
        updatedCosts = updatedCosts.map(c => c.id === editingCost.id ? { ...c, ...costData } : c);
      } else {
        const newCost: CostItem = {
          id: Math.random().toString(36).substr(2, 9),
          ...costData
        };
        updatedCosts.push(newCost);
      }

      const newTotal = updatedCosts.reduce((acc, curr) => acc + Number(curr.value), 0);

      await updateDoc(bbqRef, {
        costs: updatedCosts,
        totalCost: newTotal
      });

      setShowCostForm(false);
      setEditingCost(null);
      setCostData({ description: '', value: 0, isReservation: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!user || !id || user.email !== 'sapemailb1@gmail.com') return;

    try {
      const bbqRef = doc(db, 'bbqs', id);
      const updatedCosts = bbq.costs.filter(c => c.id !== costId);
      const newTotal = updatedCosts.reduce((acc, curr) => acc + Number(curr.value), 0);

      await updateDoc(bbqRef, {
        costs: updatedCosts,
        totalCost: newTotal
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bbqs/${id}`);
    }
  };

  if (!bbq) return null;

  // Calculations
  const totalParticipants = participants.length;
  const totalGuests = participants.reduce((acc, p) => acc + (p.guestCount || 0), 0);
  const totalPeople = totalParticipants + totalGuests;
  const costPerPerson = totalParticipants > 0 ? bbq.totalCost / totalParticipants : 0;
  
  // Rule of thumb: 400g meat per person, 1.5L drink per person
  const meatNeeded = totalPeople * 0.4; // kg
  const drinksNeeded = totalPeople * 1.5; // L

  const itemCounts = participants.reduce((acc, p) => {
    const items = p.itemToBring.split(', ');
    items.forEach(item => {
      if (STANDARD_ITEMS.includes(item)) {
        acc[item] = (acc[item] || 0) + 1;
      }
    });
    return acc;
  }, {} as { [key: string]: number });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {format(new Date(bbq.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-gray-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{bbq.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(bbq.date), "HH:mm")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user?.email === 'sapemailb1@gmail.com' && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowEditBbqForm(true)}
                      className="p-2 text-gray-400 hover:text-orange-600 transition-colors bg-gray-50 rounded-xl"
                      title="Editar Evento"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleDeleteBbq}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 rounded-xl"
                      title="Excluir Evento"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-2xl font-bold">
                  {bbq.status === 'planned' ? 'Planejado' : 'Finalizado'}
                </div>
              </div>
            </div>

            {showEditBbqForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-6 bg-orange-50 rounded-3xl border border-orange-100"
              >
                <h3 className="font-bold text-orange-900 mb-4">Editar Informações do Churrasco</h3>
                <form onSubmit={handleUpdateBbq} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={bbqForm.date}
                      onChange={e => setBbqForm({...bbqForm, date: e.target.value})}
                    />
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={bbqForm.time}
                      onChange={e => setBbqForm({...bbqForm, time: e.target.value})}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Local"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={bbqForm.location}
                    onChange={e => setBbqForm({...bbqForm, location: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Endereço"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={bbqForm.address}
                    onChange={e => setBbqForm({...bbqForm, address: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Chave PIX"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={bbqForm.pixKey}
                    onChange={e => setBbqForm({...bbqForm, pixKey: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold">Salvar</button>
                    <button type="button" onClick={() => setShowEditBbqForm(false)} className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600">Cancelar</button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-8">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Endereço do Condomínio</h3>
              <p className="text-gray-600">{bbq.address}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-orange-50 rounded-2xl text-center">
                <Users className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{totalPeople}</div>
                <div className="text-xs text-gray-500 uppercase font-semibold">Total Pessoas</div>
                {totalGuests > 0 && <div className="text-[10px] text-orange-400 font-bold">({totalParticipants} + {totalGuests} conv.)</div>}
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl text-center">
                <Beef className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{meatNeeded.toFixed(1)}kg</div>
                <div className="text-xs text-gray-500 uppercase font-semibold">Carne Est.</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-2xl text-center">
                <Beer className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{drinksNeeded.toFixed(1)}L</div>
                <div className="text-xs text-gray-500 uppercase font-semibold">Bebida Est.</div>
              </div>
              <div className="p-4 bg-green-50 rounded-2xl text-center">
                <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">R$ {costPerPerson.toFixed(2)}</div>
                <div className="text-xs text-gray-500 uppercase font-semibold">Rateio/Pessoa</div>
              </div>
            </div>
          </div>

          {/* Staff Management */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                Equipe de Apoio (Staff)
              </h2>
              {user?.email === 'sapemailb1@gmail.com' && (
                <button 
                  onClick={() => setShowStaffForm(true)}
                  className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:text-orange-700"
                >
                  <Plus className="w-4 h-4" /> Contratar
                </button>
              )}
            </div>

            {showStaffForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-200"
              >
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input 
                      type="text" 
                      placeholder="Nome do Profissional"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={staffData.name}
                      onChange={e => setStaffData({...staffData, name: e.target.value})}
                    />
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                      value={staffData.role}
                      onChange={e => setStaffData({...staffData, role: e.target.value as any})}
                    >
                      <option value="Churrasqueiro">Churrasqueiro</option>
                      <option value="Garçom">Garçom</option>
                    </select>
                    <input 
                      type="tel" 
                      placeholder="Telefone"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={staffData.phone}
                      onChange={e => setStaffData({...staffData, phone: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all"
                    >
                      Adicionar à Equipe
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowStaffForm(false)}
                      className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bbq.staff && bbq.staff.length > 0 ? (
                bbq.staff.map((member) => (
                  <div key={member.id} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        {member.role === 'Churrasqueiro' ? <Beef className="w-5 h-5 text-orange-600" /> : <Beer className="w-5 h-5 text-orange-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{member.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className="font-bold text-orange-600 uppercase">{member.role}</span>
                          {member.phone && <span>• {member.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {user?.email === 'sapemailb1@gmail.com' && (
                      <button 
                        onClick={() => handleDeleteStaff(member.id)}
                        className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full p-8 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-gray-500 text-sm italic">
                  Nenhum profissional contratado para este evento.
                </div>
              )}
            </div>
          </div>

          {/* Detailed Costs */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                Detalhamento de Custos Previstos
              </h2>
              {user?.email === 'sapemailb1@gmail.com' && (
                <button 
                  onClick={() => {
                    setEditingCost(null);
                    setCostData({ description: '', value: 0, isReservation: false });
                    setShowCostForm(true);
                  }}
                  className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:text-orange-700"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              )}
            </div>

            {showCostForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-200"
              >
                <form onSubmit={handleSaveCost} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Descrição do Gasto"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={costData.description}
                      onChange={e => setCostData({...costData, description: e.target.value})}
                    />
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-gray-400">R$</span>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                        value={costData.value || ''}
                        onChange={e => setCostData({...costData, value: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                      checked={costData.isReservation}
                      onChange={e => setCostData({...costData, isReservation: e.target.checked})}
                    />
                    <span className="text-sm text-gray-600">Este custo é para reserva antecipada</span>
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all"
                    >
                      {editingCost ? 'Salvar Alterações' : 'Adicionar Custo'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowCostForm(false)}
                      className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="space-y-4">
              {bbq.costs?.map((cost) => (
                <div key={cost.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl group">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{cost.description}</div>
                    {cost.isReservation && (
                      <div className="text-xs text-orange-600 font-bold uppercase mt-1">Antecipado para Reserva</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold text-gray-900">R$ {Number(cost.value).toFixed(2)}</div>
                    {user?.email === 'sapemailb1@gmail.com' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingCost(cost);
                            setCostData({ description: cost.description, value: cost.value, isReservation: !!cost.isReservation });
                            setShowCostForm(true);
                          }}
                          className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCost(cost.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center p-6 bg-orange-600 rounded-2xl text-white">
                <span className="font-bold text-lg">Total de Custos Previstos</span>
                <span className="text-2xl font-extrabold">R$ {bbq.totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Receipts Area */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                Comprovantes de Gastos
              </h2>
              {user?.email === 'sapemailb1@gmail.com' && (
                <button 
                  onClick={() => setShowReceiptForm(true)}
                  className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:text-orange-700"
                >
                  <Upload className="w-4 h-4" /> Anexar
                </button>
              )}
            </div>

            {showReceiptForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-200"
              >
                <form onSubmit={handleAddReceipt} className="space-y-4">
                  <input 
                    type="url" 
                    placeholder="URL da Imagem do Comprovante"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={receiptData.url}
                    onChange={e => setReceiptData({...receiptData, url: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Descrição do Gasto"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={receiptData.description}
                    onChange={e => setReceiptData({...receiptData, description: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all"
                    >
                      Salvar Comprovante
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowReceiptForm(false)}
                      className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bbq.receipts && bbq.receipts.length > 0 ? (
                bbq.receipts.map((receipt) => (
                  <a 
                    key={receipt.id} 
                    href={receipt.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative aspect-video rounded-2xl overflow-hidden border border-gray-100 hover:border-orange-200 transition-all"
                  >
                    <img 
                      src={receipt.url} 
                      alt={receipt.description}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <div className="text-white">
                        <div className="font-bold text-sm">{receipt.description}</div>
                        <div className="text-[10px] opacity-80">{format(new Date(receipt.uploadedAt), 'dd/MM/yyyy HH:mm')}</div>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="col-span-full p-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum comprovante anexado ainda.</p>
                </div>
              )}
            </div>
          </div>

          {/* Participants List */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Participantes</h2>
              <div className="flex items-center gap-3">
                {user?.email === 'sapemailb1@gmail.com' && (
                  <button 
                    onClick={() => setShowImportModal(true)}
                    className="text-orange-600 text-xs font-bold flex items-center gap-1 hover:text-orange-700 border border-orange-100 px-3 py-1.5 rounded-full"
                  >
                    <History className="w-3 h-3" /> Importar de Anterior
                  </button>
                )}
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                  {participants.filter(p => p.paid).length} pagos
                </span>
              </div>
            </div>

            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Importar Participantes</h3>
                  <p className="text-sm text-gray-500 mb-6">Selecione um churrasco anterior para copiar a lista de nomes, e-mails e telefones.</p>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-2">
                    {allBbqs.length > 0 ? allBbqs.map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleImportParticipants(b.id)}
                        className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all group"
                      >
                        <div className="font-bold text-gray-900 group-hover:text-orange-600">{format(new Date(b.date), "dd/MM/yyyy")}</div>
                        <div className="text-xs text-gray-500">{b.location}</div>
                      </button>
                    )) : (
                      <div className="text-center py-8 text-gray-400 italic">Nenhum churrasco anterior encontrado.</div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setShowImportModal(false)}
                    className="w-full py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                </motion.div>
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {participants.length > 0 ? (
                participants.map(p => (
                  <div key={p.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                        p.paid ? "bg-green-500" : "bg-gray-300"
                      )}>
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Beef className="w-3 h-3" /> {p.itemToBring}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {user?.email === 'sapemailb1@gmail.com' && (
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {(user?.email === 'sapemailb1@gmail.com' || user?.uid === bbq.createdBy) && (
                          <button 
                            onClick={() => togglePaid(p.id, p.paid)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                              p.paid 
                                ? "bg-green-100 text-green-700 hover:bg-green-200" 
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {p.paid ? <CheckCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                            {p.paid ? 'Pago' : 'Marcar Pago'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-500">
                  Ninguém confirmou ainda. Seja o primeiro!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Pagamento do Rateio</h3>
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 mb-4">
              <div className="text-xs text-green-700 font-bold uppercase mb-1">Chave PIX</div>
              <div className="text-lg font-mono font-bold text-green-900 break-all">{bbq.pixKey}</div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              O valor do rateio é calculado dividindo os custos gerais (carvão, gelo, etc) pelo número de participantes.
            </p>
          </div>

          {!showJoinForm ? (
            <button 
              onClick={() => setShowJoinForm(true)}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" />
              Confirmar Presença
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-xl border border-orange-200 p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">{editingParticipant ? 'Editar Participante' : 'Confirmar Presença'}</h3>
                <button onClick={() => { setShowJoinForm(false); setEditingParticipant(null); }} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleJoin} className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Seu Nome"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={joinData.name}
                  onChange={e => setJoinData({...joinData, name: e.target.value})}
                />
                <input 
                  type="email" 
                  placeholder="Seu E-mail (Opcional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={joinData.email}
                  onChange={e => setJoinData({...joinData, email: e.target.value})}
                />
                <input 
                  type="tel" 
                  placeholder="Telefone"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={joinData.phone}
                  onChange={e => setJoinData({...joinData, phone: e.target.value})}
                />

                {bbq.allowGuests && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Levará Convidados? (Quantidade)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="10"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={joinData.guestCount}
                      onChange={e => setJoinData({...joinData, guestCount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">O que vai levar? (Múltiplos)</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-100 rounded-xl">
                    {STANDARD_ITEMS.map(item => {
                      const limit = bbq.itemLimits?.[item];
                      const currentCount = itemCounts[item] || 0;
                      const isAlreadySelected = editingParticipant?.itemToBring.includes(item);
                      const isFull = limit && currentCount >= limit && !isAlreadySelected;
                      
                      return (
                        <label 
                          key={item} 
                          className={cn(
                            "flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors",
                            isFull && "opacity-50 cursor-not-allowed bg-gray-50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                              disabled={isFull}
                              checked={joinData.items.includes(item)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setJoinData({...joinData, items: [...joinData.items, item]});
                                } else {
                                  setJoinData({...joinData, items: joinData.items.filter(i => i !== item)});
                                }
                              }}
                            />
                            <span className={cn(isFull && "line-through")}>{item}</span>
                          </div>
                          {limit && (
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full",
                              isFull ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                            )}>
                              {currentCount}/{limit}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Outro item..."
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                    value={joinData.customItem}
                    onChange={e => setJoinData({...joinData, customItem: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all"
                >
                  {editingParticipant ? 'Salvar Alterações' : 'Confirmar Agora'}
                </button>
              </form>
            </motion.div>
          )}

          {/* Admin Area */}
          {user?.email === 'sapemailb1@gmail.com' && (
            <div className="bg-gray-900 rounded-3xl shadow-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-red-500" />
                <h3 className="font-bold">Área Administrativa</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">Como administrador, você pode cadastrar participantes e gerenciar pagamentos diretamente.</p>
              
              <button 
                onClick={() => {
                  setShowJoinForm(true);
                  setEditingParticipant(null);
                  setJoinData({ name: 'Convidado Admin', email: '', phone: '', items: [], customItem: '', guestCount: 0 });
                }}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Nome
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authReady) return null;

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Navbar user={user} />
        <main>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/new" element={<NewBBQ user={user} />} />
            <Route path="/bbq/:id" element={<BBQDetail user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
