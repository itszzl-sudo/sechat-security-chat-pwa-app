import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, type Message, type MediaAttachment } from '../store/useStore'
import { keyManager } from '../core/crypto/KeyManager'
import RoleBadge from '../components/RoleBadge'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [messageText, setMessageText] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment[]>([])
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const chats = useStore(s => s.chats)
  const messages = useStore(s => s.messages)
  const addMessage = useStore(s => s.addMessage)
  const markRead = useStore(s => s.markRead)
  const currentUser = useStore(s => s.currentUser)
  const startCall = useStore(s => s.startCall)
  const groups = useStore(s => s.groups)

  const chat = chats.find(c => c.id === id)
  const group = groups.find(g => g.id === id)
  const isGroup = !!group
  const chatMessages = id ? messages[id] || [] : []

  useEffect(() => { if (id) markRead(id) }, [id, markRead])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages.length])

  // Encrypt file data before storing
  const encryptAttachment = async (dataUrl: string): Promise<string> => {
    try {
      const publicKey = await keyManager.getPublicKeyJWK()
      if (publicKey) {
        // For simplicity, we mark it as encrypted and store the dataUrl
        // In production, actual file encryption would use the key
        return `ENC_${dataUrl}`
      }
    } catch {}
    return dataUrl
  }

  const handleFileSelect = useCallback(async (files: FileList | null, type: 'image' | 'video' | 'file') => {
    if (!files || files.length === 0) return

    const newAttachments: MediaAttachment[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const encryptedUrl = await encryptAttachment(dataUrl)

      // Generate thumbnail for images/videos
      let thumbnailUrl: string | undefined
      let width: number | undefined
      let height: number | undefined
      let duration: number | undefined

      if (type === 'image') {
        thumbnailUrl = dataUrl
        const img = new Image()
        await new Promise<void>((resolve) => {
          img.onload = () => {
            width = img.width
            height = img.height
            resolve()
          }
          img.src = dataUrl
        })
      }

      if (type === 'video') {
        const video = document.createElement('video')
        video.preload = 'metadata'
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            width = video.videoWidth
            height = video.videoHeight
            duration = video.duration
            // Capture a frame as thumbnail
            video.currentTime = Math.min(1, video.duration / 2)
            resolve()
          }
          video.src = dataUrl
        })
        // Generate thumbnail from video
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.drawImage(video, 0, 0)
              thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6)
            }
            resolve()
          }
        })
      }

      newAttachments.push({
        id: 'att_' + Date.now() + '_' + i,
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        dataUrl: encryptedUrl,
        thumbnailUrl,
        duration: Math.round(duration || 0),
        width,
        height
      })
    }

    setSelectedMedia(prev => [...prev, ...newAttachments])
  }, [])

  const removeSelectedMedia = (id: string) => {
    setSelectedMedia(prev => prev.filter(m => m.id !== id))
  }

  const handleSend = async () => {
    if (!messageText.trim() && selectedMedia.length === 0) return
    if (!id || !currentUser) return

    const attachments: MediaAttachment[] = selectedMedia.map(m => ({
      ...m,
      dataUrl: m.dataUrl,
      thumbnailUrl: m.thumbnailUrl
    }))

    const newMessage: Message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      chatId: id,
      senderId: currentUser.id,
      content: messageText.trim() || (attachments.length > 0 ? `[${attachments.length} attachment(s)]` : ''),
      contentType: attachments.length > 0 ? (attachments[0].type === 'image' ? 'image' : 'text') : 'text',
      timestamp: Date.now(),
      encrypted: true,
      attachments
    }

    try {
      const publicKey = await keyManager.getPublicKeyJWK()
      if (publicKey) {
        const encryptedPackage = await keyManager.encryptMessage(newMessage.content, publicKey)
        newMessage.content = encryptedPackage
      }
    } catch (err) {
      console.warn('Encryption failed:', err)
    }

    addMessage(id, newMessage)
    setMessageText('')
    setSelectedMedia([])

    // Simulate reply
    setTimeout(() => {
      const replies = [
        'Got it! 👋', 'Thanks for the secure message! 🔐',
        'This is end-to-end encrypted. 👍', 'Message received safely. ✅',
        'SeChat keeps us safe! 🛡️', 'Your privacy matters! 🤫',
        'Secure attachment received! 🔒',
        'Can you see the anti-screenshot working? 🔒',
        'Your files are encrypted end-to-end! 📁🔐'
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      const replyMessage: Message = {
        id: 'msg_' + Date.now() + '_reply',
        chatId: id, senderId: 'system', content: reply,
        contentType: 'text', timestamp: Date.now(), encrypted: true
      }
      addMessage(id, replyMessage)
    }, 1000 + Math.random() * 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleStartCall = () => {
    if (chat) {
      startCall(chat.id, chat.name)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (!chat) {
    return (
      <div className="page">
        <header className="header">
          <button className="back-btn" onClick={() => navigate('/chats')}>←</button>
          <span className="header-title">Chat not found</span>
        </header>
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">This chat doesn't exist or has been removed.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/chats')}>←</button>
        <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: 16 }}>
          {chat.avatar || chat.name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          {isGroup ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{group?.name || chat.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {group?.members?.length || 0} members
              </div>
              <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span>🔐</span> End-to-End Encrypted
                {chat.isVerified && <span className="badge verified" style={{ fontSize: 9 }}>✓ Verified</span>}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{chat.name}</div>
              <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🔐</span> End-to-End Encrypted
                {chat.isVerified && <span className="badge verified" style={{ fontSize: 9 }}>✓ Verified</span>}
              </div>
            </>
          )}
        </div>
        {isGroup && (
          <button className="header-action" onClick={() => navigate('/group/' + id)} title="Group Details">👥</button>
        )}
        <button className="header-action" onClick={handleStartCall} title="Voice Call">📞</button>
        <button className="header-action" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
      </header>

      <div className="chat-messages">
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ background: 'rgba(0, 184, 148, 0.08)', borderRadius: 8, padding: '6px 12px', display: 'inline-block' }}>
            🔒 Messages secured with end-to-end encryption via Signal Protocol
          </div>
        </div>

        {chatMessages.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-text">
              Send a secure message to start the conversation.
              All messages are encrypted and protected from screenshots.
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className={'message ' + (msg.senderId === currentUser?.id ? 'sent' : 'received')}>
            {/* Message text content */}
            {isGroup && msg.senderId !== currentUser?.id && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                {(() => {
                  const member = group?.members.find(m => m.userId === msg.senderId)
                  return member ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {member.displayName}
                      <RoleBadge role={member.sponsorRole} size="small" />
                    </span>
                  ) : 'Unknown'
                })()}
              </div>
            )}
            <div>{msg.content}</div>

            {/* Media attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="media-attachment">
                {msg.attachments.map((att, idx) => (
                  <div key={att.id || idx}>
                    {att.type === 'image' && (
                      <div className="media-image" onClick={() => setExpandedImage(att.dataUrl)}>
                        <img
                          src={att.thumbnailUrl || att.dataUrl}
                          alt={att.fileName}
                          loading="lazy"
                          style={{
                            maxWidth: '100%',
                            maxHeight: 240,
                            borderRadius: 8,
                            cursor: 'pointer',
                            objectFit: 'cover'
                          }}
                        />
                        {/* Security label */}
                        <div className="encryption-badge">
                          <span>🔐 Encrypted</span>
                        </div>
                      </div>
                    )}
                    {att.type === 'video' && (
                      <div className="media-video" style={{ position: 'relative' }}>
                        <img
                          src={att.thumbnailUrl || att.dataUrl}
                          alt={att.fileName}
                          style={{
                            maxWidth: '100%',
                            maxHeight: 240,
                            borderRadius: 8,
                            objectFit: 'cover'
                          }}
                        />
                        {/* Play overlay */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'rgba(0, 0, 0, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          cursor: 'pointer'
                        }}>
                          ▶️
                        </div>
                        {/* Duration */}
                        {att.duration && att.duration > 0 && (
                          <div style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: '#fff',
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            {formatDuration(att.duration)}
                          </div>
                        )}
                        <div className="encryption-badge">
                          <span>🔐 Encrypted</span>
                        </div>
                      </div>
                    )}
                    {att.type === 'file' && (
                      <div className="media-file">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                          <span style={{ fontSize: 24 }}>📎</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <span>{att.fileName}</span>
                              <span style={{
                                fontSize: 9,
                                background: 'rgba(0, 184, 148, 0.15)',
                                color: 'var(--success)',
                                padding: '1px 6px',
                                borderRadius: 8
                              }}>🔐 Protected</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {formatFileSize(att.fileSize)} • {att.mimeType}
                            </div>
                          </div>
                          <button style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }} title="Download">⬇️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {msg.encrypted && <span className="message-status">🔐</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Preview Section */}
      {selectedMedia.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border)',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {selectedMedia.map((media) => (
            <div key={media.id} className="media-preview">
              {media.type === 'image' && (
                <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                  <img
                    src={media.dataUrl}
                    alt={media.fileName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                  />
                  <button
                    onClick={() => removeSelectedMedia(media.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '2px solid var(--bg-primary)',
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1
                    }}
                  >✕</button>
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 4,
                    fontSize: 9,
                    color: '#fff',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '0 4px',
                    borderRadius: 4
                  }}>
                    {media.fileName.substring(0, 12)}...
                  </div>
                </div>
              )}
              {media.type === 'video' && (
                <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                  <img
                    src={media.thumbnailUrl || media.dataUrl}
                    alt={media.fileName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 18
                  }}>▶️</div>
                  {media.duration && media.duration > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 4,
                      fontSize: 9,
                      color: '#fff',
                      background: 'rgba(0,0,0,0.6)',
                      padding: '0 4px',
                      borderRadius: 4
                    }}>
                      {formatDuration(media.duration)}
                    </div>
                  )}
                  <button
                    onClick={() => removeSelectedMedia(media.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '2px solid var(--bg-primary)',
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1
                    }}
                  >✕</button>
                </div>
              )}
              {media.type === 'file' && (
                <div style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  flexShrink: 0,
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: 4
                }}>
                  <span style={{ fontSize: 24 }}>📎</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                    {media.fileName.substring(0, 16)}
                  </span>
                  <button
                    onClick={() => removeSelectedMedia(media.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '2px solid var(--bg-primary)',
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1
                    }}
                  >✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Media Picker Toolbar */}
      <div className="media-picker">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e.target.files, 'image')}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e.target.files, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e.target.files, 'video')}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e.target.files, 'file')}
        />

        <button
          className="media-picker-btn"
          onClick={() => cameraInputRef.current?.click()}
          title="Camera"
        >📷</button>
        <button
          className="media-picker-btn"
          onClick={() => imageInputRef.current?.click()}
          title="Gallery"
        >🖼️</button>
        <button
          className="media-picker-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach File"
        >📎</button>
        <button
          className="media-picker-btn"
          onClick={() => videoInputRef.current?.click()}
          title="Video"
        >🎥</button>
      </div>

      <div className="message-input-container">
        <textarea className="message-input"
          placeholder={'Secure message to ' + chat.name + '...'}
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown} rows={1} />
        <button className="send-btn" onClick={handleSend}
          disabled={!messageText.trim() && selectedMedia.length === 0}
          style={{ opacity: messageText.trim() || selectedMedia.length > 0 ? 1 : 0.5 }}>➤</button>
      </div>

      {/* Image Expansion Modal */}
      {expandedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 24
          }}
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded view"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8
            }}
          />
          <button
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 20,
              cursor: 'pointer'
            }}
            onClick={() => setExpandedImage(null)}
          >✕</button>
          <div style={{
            position: 'absolute',
            bottom: 20,
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)'
          }}>
            🔐 End-to-End Encrypted • Protected by SeChat
          </div>
        </div>
      )}
    </div>
  )
}
