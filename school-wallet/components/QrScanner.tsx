'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onScan: (value: string) => void
}

export default function QrScanner({ onScan }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<any>(null)
  const startingRef = useRef(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function startScanner() {
    if (startingRef.current || scannerRef.current || !ref.current) return

    startingRef.current = true
    setError('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้ Chrome หรือ Edge และเปิดผ่าน localhost/HTTPS',
        )
        return
      }

      const mod = await import('html5-qrcode')
      const scanner = new mod.Html5Qrcode('school-wallet-qr-scanner')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        async (text: string) => {
          if (!text) return

          onScan(text.replace(/^SW:/i, '').trim())
          await stopScanner()
        },
        () => {
          // Ignore normal scan-frame failures; they happen while no QR is visible.
        },
      )

      setRunning(true)
    } catch (error: any) {
      console.error('[QrScanner] camera error:', error)
      scannerRef.current = null
      setRunning(false)

      const name = error?.name || ''

      if (
        name === 'NotAllowedError' ||
        /permission denied/i.test(String(error))
      ) {
        setError(
          'ไม่สามารถใช้กล้องได้ เพราะเบราว์เซอร์ยังไม่ได้อนุญาตให้ใช้กล้อง กรุณากดไอคอน 🔒/กล้องข้าง URL แล้วเลือก Allow จากนั้นกด “เปิดกล้อง” อีกครั้ง',
        )
      } else if (name === 'NotFoundError') {
        setError(
          'ไม่พบกล้องในอุปกรณ์นี้ กรุณาตรวจสอบว่ามีกล้องและไม่ได้ถูกปิดใช้งาน',
        )
      } else if (name === 'NotReadableError') {
        setError(
          'กล้องกำลังถูกใช้งานโดยโปรแกรมอื่น กรุณาปิดโปรแกรมที่ใช้กล้องอยู่แล้วลองอีกครั้ง',
        )
      } else {
        setError(`เปิดกล้องไม่สำเร็จ: ${error?.message || String(error)}`)
      }
    } finally {
      startingRef.current = false
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    scannerRef.current = null
    setRunning(false)

    if (scanner) {
      try {
        await scanner.stop()
      } catch {
        // Scanner may already be stopped.
      }

      try {
        scanner.clear()
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      scannerRef.current = null

      if (scanner) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div>
      <div
        id="school-wallet-qr-scanner"
        ref={ref}
        className="scanner"
        style={{ minHeight: 280 }}
      />

      {!running && (
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={startScanner}
          disabled={startingRef.current}
        >
          📷 เปิดกล้องเพื่อสแกน QR
        </button>
      )}

      {running && (
        <button
          type="button"
          className="btn dark"
          style={{ marginTop: 12, width: '100%' }}
          onClick={stopScanner}
        >
          ปิดกล้อง
        </button>
      )}

      {error && (
        <div className="status error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}
