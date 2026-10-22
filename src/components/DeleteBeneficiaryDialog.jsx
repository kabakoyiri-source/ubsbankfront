import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { removeBeneficiaryFavorite } from '../services/beneficiaries'
import './DeleteBeneficiaryDialog.css'

function DeleteBeneficiaryDialog({ client, onCancel, onDeleted }) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const name = [client.firstName, client.lastName].filter(Boolean).join(' ')

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  const cancel = () => { if (!busy.current) onCancel() }
  const handleKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel() }
    if (event.key !== 'Tab') return
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) {
      event.preventDefault(); first.focus()
    }
  }
  const remove = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const response = await api.delete(`/clients/${client._id}`)
      if (!response.data.success) throw new Error("Unable to delete")
      removeBeneficiaryFavorite(client._id)
      onDeleted(client)
    } catch (error) {
      setError(error.response?.data?.message || "Unable to delete the beneficiary. Try again.")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return createPortal(
    <div className="beneficiary-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) cancel() }}>
      <div ref={dialogRef} className="beneficiary-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending} onKeyDown={handleKeyDown}>
        <h2 id={titleId}>Delete this beneficiary?</h2>
        <div className="beneficiary-dialog-copy" id={descriptionId}>
          <p><strong>{name}</strong><span className="beneficiary-dialog-account">{client.accountNumber}</span></p>
          <p>This beneficiary will be removed from your list and new transfers. Existing transactions will remain in your history.</p>
          <p>Pending transfers will remain pending. You can cancel them in Transactions.</p>
        </div>
        {error && <p className="beneficiary-dialog-error" role="alert">{error}</p>}
        <div className="beneficiary-dialog-actions">
          <button ref={cancelRef} type="button" onClick={cancel} disabled={pending}>Cancel</button>
          <button type="button" className="beneficiary-dialog-delete" onClick={remove} disabled={pending}>
            {pending ? "Deleting…" : "Delete beneficiary"}
          </button>
        </div>
      </div>
    </div>, document.body
  )
}
export default DeleteBeneficiaryDialog
