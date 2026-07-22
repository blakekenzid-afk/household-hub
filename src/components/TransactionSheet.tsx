import { useState } from 'react'
import Sheet from './Sheet'
import { db, type Transaction } from '../db'
import { addDays, todayStr } from '../dates'
import { parseAmountToCents } from '../money'
import { categoriesFor } from '../finance-data'

interface Props {
  transaction?: Transaction
  onClose: () => void
}

export default function TransactionSheet({ transaction, onClose }: Props) {
  const [type, setType] = useState<Transaction['type']>(transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(
    transaction ? (transaction.amount / 100).toString() : '',
  )
  const [category, setCategory] = useState(transaction?.category ?? 'Groceries')
  const [note, setNote] = useState(transaction?.note ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayStr())

  const today = todayStr()
  const yesterday = addDays(today, -1)
  const isQuickDate = date === today || date === yesterday
  const categories = categoriesFor(type)
  const cents = parseAmountToCents(amount)
  const valid = cents != null && cents > 0

  function switchType(next: Transaction['type']) {
    setType(next)
    // Keep the chosen category only if it exists in the new type's list.
    if (!categoriesFor(next).includes(category)) {
      setCategory(next === 'income' ? 'Paycheck' : 'Groceries')
    }
  }

  async function save() {
    if (cents == null || cents <= 0) return
    const fields = {
      type,
      amount: cents,
      category,
      note: note.trim() || undefined,
      date,
    }
    if (transaction) {
      await db.transactions.update(transaction.id, fields)
    } else {
      await db.transactions.add({ ...fields, createdAt: Date.now() })
    }
    onClose()
  }

  async function remove() {
    if (!transaction) return
    await db.transactions.delete(transaction.id)
    onClose()
  }

  return (
    <Sheet title={transaction ? 'Edit entry' : 'New entry'} onClose={onClose}>
      <div className="chip-row seg-row">
        <button
          className={`chip${type === 'expense' ? ' active' : ''}`}
          onClick={() => switchType('expense')}
        >
          Expense
        </button>
        <button
          className={`chip${type === 'income' ? ' active' : ''}`}
          onClick={() => switchType('income')}
        >
          Income
        </button>
      </div>

      <div className="amount-field">
        <span className="amount-currency">$</span>
        <input
          className="amount-input"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>

      <div className="sheet-label">Category</div>
      <div className="chip-row wrap">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip${category === c ? ' active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="sheet-label">Date</div>
      <div className="chip-row">
        <button
          className={`chip${date === today ? ' active' : ''}`}
          onClick={() => setDate(today)}
        >
          Today
        </button>
        <button
          className={`chip${date === yesterday ? ' active' : ''}`}
          onClick={() => setDate(yesterday)}
        >
          Yesterday
        </button>
        <input
          type="date"
          className={`chip date-chip${!isQuickDate ? ' active' : ''}`}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="Entry date"
        />
      </div>

      <div className="sheet-label">Note</div>
      <input
        className="sheet-input"
        placeholder="What was it? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button className="btn" disabled={!valid} onClick={() => void save()}>
        {transaction ? 'Save' : 'Add entry'}
      </button>
      {transaction && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
