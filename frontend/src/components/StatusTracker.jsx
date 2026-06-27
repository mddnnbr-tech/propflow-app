import { CheckCircle, Circle, Clock, Truck, Hammer, Star } from 'lucide-react';

const STEPS = [
  { key: 'OPEN', label: 'Submitted', icon: Clock, desc: 'Request received' },
  { key: 'DISPATCHED', label: 'Vendor Assigned', icon: Truck, desc: 'Contractor notified' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: Hammer, desc: 'Work underway' },
  { key: 'COMPLETED', label: 'Complete', icon: Star, desc: 'Job done' },
];

const ORDER = ['OPEN', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED'];

export default function StatusTracker({ status, vendor, dispatchedAt, completedAt }) {
  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="bg-white rounded-2xl border p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Request Status</p>

      {/* Progress bar */}
      <div className="relative mb-2">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-blue-500 z-0 transition-all duration-500"
          style={{ width: currentIdx === 0 ? '0%' : `${(currentIdx / (ORDER.length - 1)) * 100}%` }}
        />
        <div className="relative z-10 flex justify-between">
          {STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const future = idx > currentIdx;
            const { icon: Icon } = step;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  done ? 'bg-blue-500' : active ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-gray-100'
                }`}>
                  {done ? (
                    <CheckCircle size={16} className="text-white" />
                  ) : (
                    <Icon size={15} className={active ? 'text-white' : 'text-gray-400'} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        {STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={step.key} className="flex-1 text-center px-1">
              <p className={`text-xs font-semibold ${active ? 'text-blue-600' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Current status detail */}
      <div className="mt-4 p-3 bg-blue-50 rounded-xl">
        {status === 'OPEN' && (
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Reviewing your request.</span> Your property manager has been notified and will assign a vendor shortly.
          </p>
        )}
        {status === 'DISPATCHED' && vendor && (
          <div>
            <p className="text-sm text-blue-700 font-semibold">{vendor.name} has been assigned</p>
            <p className="text-sm text-blue-600">{vendor.trade} · {vendor.phone || 'Contact info on file'}</p>
            <p className="text-xs text-blue-500 mt-1">They will reach out to schedule service. Dispatched {dispatchedAt ? new Date(dispatchedAt).toLocaleDateString() : 'today'}.</p>
          </div>
        )}
        {status === 'IN_PROGRESS' && (
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Work is underway.</span> Your vendor is actively working on this issue.
          </p>
        )}
        {status === 'COMPLETED' && (
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 font-semibold">All done! Issue resolved{completedAt ? ` on ${new Date(completedAt).toLocaleDateString()}` : ''}.</p>
          </div>
        )}
        {status === 'CANCELLED' && (
          <p className="text-sm text-gray-600">This request was cancelled.</p>
        )}
      </div>
    </div>
  );
}
