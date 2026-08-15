/**
 * Ad placement.
 *
 * Renders nothing unless VITE_ETHICALADS_PUBLISHER is set, so the site stays
 * ad-free until there is an approved publisher account.
 *
 * EthicalAds was chosen over AdSense on purpose: it serves contextual ads with
 * no cookies, no third-party tracking and no personal data collection, which
 * is the only kind of advertising that does not contradict the promise this
 * site makes on every other page. Documents are still processed locally and
 * are never visible to the ad network - the ad is chosen from the page's own
 * keywords, not from anything about the visitor.
 */

import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'

const SCRIPT_SRC = 'https://media.ethicalads.io/media/client/ethicalads.min.js'
const SCRIPT_ID = 'ethicalads-client'

const publisher = import.meta.env.VITE_ETHICALADS_PUBLISHER as string | undefined

const loadClient = () => {
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = SCRIPT_SRC
  script.async = true
  document.head.appendChild(script)
}

interface AdSlotProps {
  /** `image` is the boxed placement, `text` the single-line one. */
  variant?: 'image' | 'text'
}

const AdSlot: React.FC<AdSlotProps> = ({ variant = 'text' }) => {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!publisher) return
    loadClient()

    // The client script scans for placements on load. On client-side
    // navigation it has already run, so ask it to re-scan this node.
    const ethicalads = (window as unknown as { ethicalads?: { load: () => void } }).ethicalads
    ethicalads?.load()
  }, [])

  if (!publisher) return null

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
      <div
        ref={container}
        className="horizontal"
        data-ea-publisher={publisher}
        data-ea-type={variant}
      />
    </Box>
  )
}

export default AdSlot
