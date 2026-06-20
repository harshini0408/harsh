import { useEffect, useState, useRef } from 'react';
import api, { API_BASE } from '../../api/client';
import { KITCHEN_STATUS_LABELS, KITCHEN_STATUS_COLORS, timeAgo } from '../../utils/helpers';

export default function KDSBoard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    loadTickets();
    // Poll every 10 seconds as fallback
    const interval = setInterval(loadTickets, 10000);

    // Try WebSocket connection
    try {
      const wsUrl = API_BASE.replace('http', 'ws');
      wsRef.current = new WebSocket(`${wsUrl}/ws/kds`);
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_ticket' || data.type === 'status_update') {
          loadTickets();
        }
      };
      wsRef.current.onclose = () => console.log('KDS WebSocket closed');
    } catch (e) {
      console.log('WebSocket not available, using polling');
    }

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const loadTickets = async () => {
    try {
      const data = await api.get('/kds/tickets');
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const advanceStatus = async (itemId, currentStatus) => {
    const next = currentStatus === 'to_cook' ? 'preparing' : 'completed';
    try {
      await api.patch(`/kds/items/${itemId}/status`, { kitchen_status: next });
      loadTickets();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div style={styles.root}>
        <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>👨‍🍳</span>
          <h1 className="text-xl font-bold">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-success">{tickets.length} Active Orders</span>
          <span className="text-sm text-muted">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Tickets Grid */}
      {tickets.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: 64 }}>✅</span>
          <h2 className="text-xl font-bold mt-6">All caught up!</h2>
          <p className="text-secondary mt-4">No pending orders. New orders will appear here automatically.</p>
        </div>
      ) : (
        <div style={styles.ticketGrid}>
          {tickets.map(ticket => {
            const elapsed = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
            const urgency = elapsed > 15 ? 'danger' : elapsed > 8 ? 'warning' : 'success';

            return (
              <div key={ticket.order_id} className="card animate-fade-in" style={{
                ...styles.ticket,
                borderTop: `3px solid var(--color-${urgency})`,
              }}>
                {/* Ticket Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{ticket.order_number}</h3>
                    <p className="text-muted text-xs">
                      {ticket.table_number ? `Table ${ticket.table_number}` : 'No Table'}
                      {' · '}{ticket.source === 'self_order' ? '📱 QR' : '👤 Cashier'}
                    </p>
                  </div>
                  <div className={`badge badge-${urgency}`}>
                    {elapsed}m
                  </div>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {ticket.items.map(item => (
                    <div
                      key={item.id}
                      style={{
                        ...styles.ticketItem,
                        opacity: item.kitchen_status === 'completed' ? 0.5 : 1,
                        cursor: item.kitchen_status !== 'completed' ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (item.kitchen_status !== 'completed') {
                          advanceStatus(item.id, item.kitchen_status);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2" style={{ flex: 1 }}>
                        <span className="font-bold text-lg" style={{ minWidth: 24 }}>
                          {item.quantity}×
                        </span>
                        <span className={`font-medium ${item.kitchen_status === 'completed' ? 'text-muted' : ''}`}>
                          {item.product_name}
                        </span>
                        {item.is_loyalty_redemption && <span className="badge badge-warning">FREE</span>}
                      </div>
                      <span className={`badge badge-${KITCHEN_STATUS_COLORS[item.kitchen_status]}`}>
                        {KITCHEN_STATUS_LABELS[item.kitchen_status]}
                      </span>
                      {item.notes && (
                        <div className="w-full mt-4 text-xs text-warning">📝 {item.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
  },
  header: {
    padding: 'var(--space-4) var(--space-6)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  ticketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 'var(--space-4)',
    padding: 'var(--space-4) var(--space-6)',
    alignItems: 'start',
  },
  ticket: {
    padding: 'var(--space-4)',
  },
  ticketItem: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    gap: 'var(--space-2)',
    padding: 'var(--space-3)',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition-fast)',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '70vh', textAlign: 'center',
  },
};
