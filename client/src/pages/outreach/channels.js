import { useEffect, useState } from 'react'
import { getChannels } from '../../utils/outreachApi'

// Channels are managed in the CRM (lead drawer / Admin). One shared list for the whole
// module, so adding or renaming a channel updates every picker and colour at once.

export const DEFAULT_CHANNEL_COLOR = '#6b7280'
export const CHANNEL_PALETTE = ['#0a66c2', '#575ECF', '#25d366', '#1877f2', '#e1306c', '#f59e0b', '#06b6d4', '#a855f7', '#ef4444', '#14b8a6', '#6b7280']

// Shown until the list loads, so the usual channels don't flash grey
const FALLBACK = [
  ['LinkedIn', '#0a66c2'], ['Email', '#575ECF'], ['WhatsApp', '#25d366'], ['Facebook', '#1877f2'],
  ['Instagram', '#e1306c'], ['SMS', '#8a8680'], ['Website Form', '#06b6d4'], ['Other', '#6b7280'],
].map(([name, color], i) => ({ id: -1 - i, name, color, active: 1 }))

let channels = null
let pending = null
const listeners = new Set()

function publish(list) {
  channels = list
  listeners.forEach(fn => fn(list))
}

export function refreshChannels() {
  if (!pending) {
    pending = getChannels().then(publish).catch(() => {}).finally(() => { pending = null })
  }
  return pending
}

export function setChannels(updater) {
  publish(typeof updater === 'function' ? updater(channels || []) : updater)
}

export function useChannels() {
  const [list, setList] = useState(channels || FALLBACK)
  useEffect(() => {
    listeners.add(setList)
    if (channels) setList(channels)
    else refreshChannels()
    return () => { listeners.delete(setList) }
  }, [])
  return list
}

// { name: colour } for the channel pills and charts
export function useChannelColors() {
  const list = useChannels()
  return Object.fromEntries(list.map(c => [c.name, c.color]))
}
