'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type WalletRealtimeTable = 'students' | 'products' | 'wallet_transactions'

export function useWalletRealtime(
  onChange: (table: WalletRealtimeTable) => void,
  enabled = true,
  includeTransactions = false,
) {
  const onChangeRef = useRef(onChange)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled || !supabase) {
      setConnected(false)
      return
    }

    setError('')

    const client = supabase
    let active = true

    const channel = client.channel(
      `shine-wallet-global-realtime-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )

    async function connect() {
      const { data } = await client.auth.getSession()

      if (data.session?.access_token) {
        await client.realtime.setAuth(data.session.access_token)
      }

      if (!active) return

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students',
          },
          () => {
            onChangeRef.current('students')
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products',
          },
          () => {
            onChangeRef.current('products')
          },
        )

      if (includeTransactions) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallet_transactions',
          },
          () => {
            onChangeRef.current('wallet_transactions')
          },
        )
      }

      channel.subscribe((status, subscribeError) => {
        setConnected(status === 'SUBSCRIBED')

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(
            subscribeError?.message || `Realtime status: ${status}`,
          )
        }
      })
    }

    void connect()

    return () => {
      active = false
      setConnected(false)
      void client.removeChannel(channel)
    }
  }, [enabled, includeTransactions])

  return { connected, error }
}
