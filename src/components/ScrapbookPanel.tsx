import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { supabase } from '../utils/supabaseClient';
import { Loader2, Bold, Italic, Strikethrough, Heading1, Heading2, List, Quote } from 'lucide-react';

function getImagesFromJSON(node: any): string[] {
  if (!node) return [];
  const urls: string[] = [];
  if (node.type === 'image' && node.attrs?.src) {
    urls.push(node.attrs.src);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      urls.push(...getImagesFromJSON(child));
    }
  }
  return urls;
}

const getStoragePathFromUrl = (url: string): string | null => {
  const marker = '/public/scrapbook/';
  const index = url.indexOf(marker);
  if (index !== -1) {
    return url.substring(index + marker.length);
  }
  return null;
};

interface ScrapbookPanelProps {
  projectId: string;
}

export const ScrapbookPanel: React.FC<ScrapbookPanelProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const pendingDeletionsRef = useRef<{ [url: string]: ReturnType<typeof setTimeout> }>({});
  const knownImagesRef = useRef<Set<string>>(new Set());

  // Initialize TipTap
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: 'rounded border border-paper-darker max-w-full my-2 mx-auto block shadow-sm',
        },
      }),
      Youtube.configure({
        addPasteHandler: true,
        HTMLAttributes: {
          class: 'w-full aspect-video rounded border border-paper-darker my-2 shadow-sm',
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none min-h-[300px] h-full text-ink font-sans text-sm p-4 overflow-y-auto select-text selection:bg-terracotta/20',
      },
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) {
            event.preventDefault();
            uploadAndInsertImage(file);
            return true;
          }
        }
        return false;
      },
    },
    // Auto-save on every change with 1 second debounce, and track deleted images
    onUpdate({ editor }) {
      const json = editor.getJSON();
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('scrapbook_entries')
            .upsert(
              {
                project_id: projectId,
                content: json,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'project_id' }
            );

          if (error) {
            console.error('Failed to auto-save scrapbook entry:', error.message);
          }
        } catch (err) {
          console.error('Error auto-saving scrapbook entry:', err);
        }
      }, 1000);

      // Storage image cleanup detection
      const currentImages = getImagesFromJSON(json);
      const currentImagesSet = new Set(currentImages);

      // Add any new images to the known set and cancel any pending deletion if they reappear
      currentImages.forEach((url) => {
        knownImagesRef.current.add(url);
        if (pendingDeletionsRef.current[url]) {
          clearTimeout(pendingDeletionsRef.current[url]);
          delete pendingDeletionsRef.current[url];
        }
      });

      // Identify removed images and schedule storage deletion after 1 minute
      knownImagesRef.current.forEach((url) => {
        if (!currentImagesSet.has(url) && !pendingDeletionsRef.current[url]) {
          const timer = setTimeout(async () => {
            // Re-verify the image is still missing from the editor document before deleting
            const latestImages = getImagesFromJSON(editor.getJSON());
            if (!latestImages.includes(url)) {
              const storagePath = getStoragePathFromUrl(url);
              if (storagePath) {
                console.log('Deleting removed image from storage:', storagePath);
                const { error } = await supabase.storage.from('scrapbook').remove([storagePath]);
                if (error) {
                  console.error('Failed to delete image from storage:', error.message);
                } else {
                  knownImagesRef.current.delete(url);
                }
              }
            }
            delete pendingDeletionsRef.current[url];
          }, 60000); // 1 minute delay
          pendingDeletionsRef.current[url] = timer;
        }
      });
    },
  }, [projectId]);

  // Load scrapbook entry on mount or projectId change
  useEffect(() => {
    if (!editor || !projectId) return;

    let isMounted = true;
    setLoading(true);

    async function loadScrapbook() {
      try {
        const { data, error } = await supabase
          .from('scrapbook_entries')
          .select('content')
          .eq('project_id', projectId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching scrapbook entry:', error.message);
        }

        if (isMounted) {
          if (data?.content) {
            editor.commands.setContent(data.content);
            // Populate initial set of images currently in the document
            const initialImages = getImagesFromJSON(data.content);
            knownImagesRef.current = new Set(initialImages);
          } else {
            editor.commands.setContent({
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: 'left'
                  }
                }
              ],
            });
            knownImagesRef.current = new Set();
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading scrapbook entry:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadScrapbook();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Clean up all pending deletion timers on unmount/project switch
      Object.values(pendingDeletionsRef.current).forEach(clearTimeout);
      pendingDeletionsRef.current = {};
    };
  }, [projectId, editor]);

  // Upload image to Supabase Storage and insert inline at cursor
  const uploadAndInsertImage = async (file: File) => {
    if (!editor) return;
    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `scrapbook/${fileName}`;

      // Upload file to the 'scrapbook' bucket
      const { error: uploadError } = await supabase.storage
        .from('scrapbook')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('scrapbook')
        .getPublicUrl(filePath);

      if (!urlData.publicUrl) {
        throw new Error('Could not get public URL for uploaded file.');
      }

      // Register the uploaded image as a known image
      knownImagesRef.current.add(urlData.publicUrl);

      // Insert image into TipTap at the cursor position
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    } catch (err: any) {
      console.error('Failed to upload pasted image:', err);
      alert('Failed to upload image: ' + (err.message || String(err)));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent text-ink relative">
      {/* Styles for ProseMirror rendering matching paper/ink theme */}
      <style>{`
        .ProseMirror {
          min-height: 100%;
        }
        .ProseMirror p {
          margin-bottom: 0.75rem;
          line-height: 1.5;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.25rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror h1 {
          font-family: serif;
          font-weight: bold;
          font-size: 1.25rem;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h2 {
          font-family: serif;
          font-weight: bold;
          font-size: 1.1rem;
          margin-top: 0.75rem;
          margin-bottom: 0.4rem;
        }
        .ProseMirror blockquote {
          border-left: 2px solid var(--color-terracotta, #E25C3D);
          padding-left: 0.75rem;
          font-style: italic;
          color: var(--color-ink-muted, #78716C);
          margin: 0.75rem 0;
        }
        .ProseMirror iframe {
          width: 100% !important;
          height: auto !important;
          aspect-ratio: 16 / 9 !important;
          max-width: 100%;
        }
      `}</style>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-ink-light py-8">
          <Loader2 className="w-5 h-5 animate-spin text-terracotta mb-2" />
          <span className="font-serif italic text-xs">Loading Scrapbook...</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto paper-lines relative">
          {editor && (
            <BubbleMenu editor={editor}>
              <div className="flex items-center gap-0.5 bg-paper-dark border border-paper-darker rounded shadow-paper-md px-1.5 py-1 select-none">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('bold')
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('italic')
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('strike')
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>
            </BubbleMenu>
          )}

          {editor && (
            <FloatingMenu editor={editor}>
              <div className="flex items-center gap-0.5 bg-paper-dark border border-paper-darker rounded shadow-paper-md px-1.5 py-1 select-none">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('heading', { level: 1 })
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Heading 1"
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('heading', { level: 2 })
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Heading 2"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('bulletList')
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                    editor.isActive('blockquote')
                      ? 'bg-terracotta text-white'
                      : 'text-ink-muted hover:text-ink hover:bg-paper-active'
                  }`}
                  title="Blockquote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
              </div>
            </FloatingMenu>
          )}

          <EditorContent editor={editor} className="flex-1 h-full min-h-0" />
          
          {uploadingImage && (
            <div className="absolute inset-0 bg-paper/60 backdrop-blur-[1px] flex items-center justify-center z-20">
              <div className="bg-paper-dark border border-paper-darker rounded-lg px-4 py-2 shadow-md flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-terracotta" />
                <span className="text-xs font-semibold text-ink">Uploading image...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
