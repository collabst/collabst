import React, { useState, useRef } from 'react'
import type { Asset } from '../types'

interface AssetPanelProps {
  assets: Asset[]
  projectId: number
  onUpload: (file: File) => Promise<void>
  onDelete: (assetId: number) => Promise<void>
  onGetUrl: (assetId: number) => Promise<string>
  readOnly?: boolean
}

export const AssetPanel: React.FC<AssetPanelProps> = ({
  assets,
  projectId,
  onUpload,
  onDelete,
  onGetUrl,
  readOnly = false,
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      await onUpload(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload asset:', error)
      alert('Failed to upload asset')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAssetClick = async (asset: Asset) => {
    setSelectedAsset(asset)
    try {
      const url = await onGetUrl(asset.id)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Failed to get asset URL:', error)
    }
  }

  const handleDelete = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      await onDelete(assetId)
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null)
        setPreviewUrl(null)
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      alert('Failed to delete asset')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType === 'application/pdf') return '📄'
    return '📎'
  }

  const isImage = (mimeType: string) => mimeType.startsWith('image/')
  const isPdf = (mimeType: string) => mimeType === 'application/pdf'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Assets ({assets.length})</h3>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={styles.hiddenInput}
              id="asset-upload"
            />
            <label htmlFor="asset-upload" style={styles.uploadButton}>
              {isUploading ? '⏳' : '📤'}
            </label>
          </>
        )}
      </div>

      <div style={styles.content}>
        {assets.length === 0 ? (
          <div style={styles.empty}>
            {readOnly ? 'No assets in this project.' : 'No assets yet. Upload images, PDFs, or other files.'}
          </div>
        ) : (
          <div style={styles.assetList}>
            {assets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  ...styles.assetItem,
                  ...(selectedAsset?.id === asset.id ? styles.assetItemActive : {}),
                }}
                onClick={() => handleAssetClick(asset)}
              >
                <div style={styles.assetIcon}>{getFileIcon(asset.mime_type)}</div>
                <div style={styles.assetInfo}>
                  <div style={styles.assetName}>{asset.filename}</div>
                  <div style={styles.assetMeta}>{formatFileSize(asset.size)}</div>
                </div>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(asset.id)
                    }}
                    style={styles.deleteButton}
                    title="Delete asset"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedAsset && previewUrl && (
          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              <span>{selectedAsset.filename}</span>
              <button onClick={() => { setSelectedAsset(null); setPreviewUrl(null) }} style={styles.closePreview}>
                ×
              </button>
            </div>
            <div style={styles.previewContent}>
              {isImage(selectedAsset.mime_type) ? (
                <img src={previewUrl} alt={selectedAsset.filename} style={styles.previewImage} />
              ) : isPdf(selectedAsset.mime_type) ? (
                <iframe src={previewUrl} style={styles.previewIframe} title={selectedAsset.filename} />
              ) : (
                <div style={styles.previewDownload}>
                  <p>Preview not available for this file type</p>
                  <a href={previewUrl} download={selectedAsset.filename} style={styles.downloadLink}>
                    Download {selectedAsset.filename}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '300px',
    background: '#252526',
    borderLeft: '1px solid #3e3e42',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #3e3e42',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
  },
  hiddenInput: {
    display: 'none',
  },
  uploadButton: {
    background: '#0e639c',
    color: 'white',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  empty: {
    padding: '2rem 1rem',
    textAlign: 'center' as const,
    color: '#888',
    fontSize: '13px',
  },
  assetList: {
    flex: 1,
    overflow: 'auto',
  },
  assetItem: {
    padding: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    borderBottom: '1px solid #3e3e42',
    color: '#ccc',
  },
  assetItemActive: {
    background: '#2a2d2e',
    borderLeft: '3px solid #0e639c',
  },
  assetIcon: {
    fontSize: '24px',
  },
  assetInfo: {
    flex: 1,
    minWidth: 0,
  },
  assetName: {
    fontSize: '13px',
    color: 'white',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  assetMeta: {
    fontSize: '11px',
    color: '#888',
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    opacity: 0.6,
  },
  preview: {
    borderTop: '1px solid #3e3e42',
    maxHeight: '50%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  previewHeader: {
    padding: '0.75rem',
    background: '#1e1e1e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
    fontSize: '12px',
  },
  closePreview: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
  },
  previewContent: {
    flex: 1,
    overflow: 'auto',
    background: '#1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
  },
  previewIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  previewDownload: {
    textAlign: 'center' as const,
    color: '#888',
  },
  downloadLink: {
    color: '#0e639c',
    textDecoration: 'none',
    display: 'block',
    marginTop: '1rem',
  },
}
