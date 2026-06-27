import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Building2, Plus, ChevronDown, ChevronUp, Pencil, Trash2, X, Users } from 'lucide-react';

const UNIT_STATUS_COLORS = {
  OCCUPIED: 'bg-green-100 text-green-700',
  VACANT: 'bg-gray-100 text-gray-600',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
};

export default function ManagerProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(null); // propertyId
  const [editingUnit, setEditingUnit] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/properties');
      setProperties(res.data);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  async function deleteProperty(id) {
    if (!confirm('Delete this property and all its units?')) return;
    await api.delete(`/properties/${id}`);
    toast.success('Property deleted');
    load();
  }

  async function deleteUnit(id) {
    if (!confirm('Delete this unit?')) return;
    await api.delete(`/properties/units/${id}`);
    toast.success('Unit deleted');
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Properties</h1>
        <button onClick={() => setShowAddProperty(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          <Plus size={16} /> Add Property
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
          <Building2 className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500">No properties yet. Add your first property to get started.</p>
          <button onClick={() => setShowAddProperty(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">Add Property</button>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property) => {
            const occupied = property.units.filter((u) => u.status === 'OCCUPIED').length;
            return (
              <div key={property.id} className="bg-white rounded-2xl border overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold">{property.name}</h3>
                      <p className="text-sm text-gray-500">{property.address}, {property.city}, {property.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 hidden sm:block">{occupied}/{property.units.length} occupied</span>
                    <button onClick={() => deleteProperty(property.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => toggle(property.id)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      {expanded[property.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expanded[property.id] && (
                  <div className="border-t p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">Units</p>
                      <button onClick={() => setShowAddUnit(property.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Plus size={12} /> Add Unit
                      </button>
                    </div>
                    {property.units.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No units yet</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {property.units.map((unit) => (
                          <div key={unit.id} className="border rounded-xl p-3 hover:border-blue-200 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-sm">Unit {unit.unitNumber}</p>
                                <p className="text-xs text-gray-500">{unit.bedrooms}bd · {unit.bathrooms}ba{unit.sqft ? ` · ${unit.sqft} sqft` : ''}</p>
                                <p className="text-sm font-bold text-blue-600 mt-1">${unit.rentAmount.toLocaleString()}/mo</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UNIT_STATUS_COLORS[unit.status]}`}>{unit.status}</span>
                                <button onClick={() => deleteUnit(unit.id)} className="text-gray-300 hover:text-red-400 transition-colors mt-1">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            {unit.lease?.tenant && (
                              <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-gray-500">
                                <Users size={11} />
                                {unit.lease.tenant.firstName} {unit.lease.tenant.lastName}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddProperty && <AddPropertyModal onClose={() => setShowAddProperty(false)} onSave={() => { setShowAddProperty(false); load(); }} />}
      {showAddUnit && <AddUnitModal propertyId={showAddUnit} onClose={() => setShowAddUnit(null)} onSave={() => { setShowAddUnit(null); load(); }} />}
    </div>
  );
}

function AddPropertyModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip: '' });
  const [units, setUnits] = useState([{ unitNumber: '', bedrooms: 1, bathrooms: 1, sqft: '', rentAmount: '' }]);
  const [loading, setLoading] = useState(false);

  function updateUnit(idx, field, value) {
    setUnits((u) => u.map((unit, i) => i === idx ? { ...unit, [field]: value } : unit));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/properties', {
        ...form,
        units: units.filter((u) => u.unitNumber).map((u) => ({
          ...u,
          bedrooms: Number(u.bedrooms),
          bathrooms: Number(u.bathrooms),
          sqft: u.sqft ? Number(u.sqft) : undefined,
          rentAmount: Number(u.rentAmount),
        })),
      });
      toast.success('Property created!');
      onSave();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Property" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Property Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunset Apartments" />
          </div>
          <div className="col-span-2">
            <label className="label">Street Address</label>
            <input className="input" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" required maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="TX" />
          </div>
          <div className="col-span-2">
            <label className="label">ZIP</label>
            <input className="input" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Units</p>
            <button type="button" onClick={() => setUnits((u) => [...u, { unitNumber: '', bedrooms: 1, bathrooms: 1, sqft: '', rentAmount: '' }])} className="text-xs text-blue-600 hover:underline">+ Add unit</button>
          </div>
          <div className="space-y-3">
            {units.map((unit, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl">
                <div>
                  <label className="label">Unit #</label>
                  <input className="input" value={unit.unitNumber} onChange={(e) => updateUnit(i, 'unitNumber', e.target.value)} placeholder="1A" />
                </div>
                <div>
                  <label className="label">Beds</label>
                  <input type="number" min={0} max={10} className="input" value={unit.bedrooms} onChange={(e) => updateUnit(i, 'bedrooms', e.target.value)} />
                </div>
                <div>
                  <label className="label">Baths</label>
                  <input type="number" min={0.5} max={10} step={0.5} className="input" value={unit.bathrooms} onChange={(e) => updateUnit(i, 'bathrooms', e.target.value)} />
                </div>
                <div>
                  <label className="label">Rent $</label>
                  <input type="number" min={0} className="input" value={unit.rentAmount} onChange={(e) => updateUnit(i, 'rentAmount', e.target.value)} placeholder="1200" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">{loading ? 'Saving...' : 'Create Property'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddUnitModal({ propertyId, onClose, onSave }) {
  const [form, setForm] = useState({ unitNumber: '', bedrooms: 1, bathrooms: 1, sqft: '', rentAmount: '' });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/properties/${propertyId}/units`, { ...form, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms), sqft: form.sqft ? Number(form.sqft) : undefined, rentAmount: Number(form.rentAmount) });
      toast.success('Unit added!');
      onSave();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Unit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Unit Number</label>
            <input className="input" required value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} placeholder="2B" />
          </div>
          <div>
            <label className="label">Bedrooms</label>
            <input type="number" min={0} className="input" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
          </div>
          <div>
            <label className="label">Bathrooms</label>
            <input type="number" min={0.5} step={0.5} className="input" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
          </div>
          <div>
            <label className="label">Sq Ft (optional)</label>
            <input type="number" min={0} className="input" value={form.sqft} onChange={(e) => setForm({ ...form, sqft: e.target.value })} />
          </div>
          <div>
            <label className="label">Monthly Rent ($)</label>
            <input type="number" min={0} className="input" required value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">{loading ? 'Saving...' : 'Add Unit'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
      <style>{`.label{@apply block text-xs font-medium text-gray-700 mb-1}.input{@apply w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500}`}</style>
    </div>
  );
}
