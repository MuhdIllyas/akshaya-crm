import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { socket } from '@/services/socket';
import {
  fetchTags, createTag, updateTag, deleteTag, reorderTags,
  addToTag, removeFromTag, tagErrorMessage,
} from '@/services/tagService';

const ITEM_KEY = { conversations: 'conversation_ids', notes: 'note_ids' };

/**
 * The signed-in person's tags, shared by Messenger and Notes.
 * kind: "conversations" | "notes" — which items this screen puts in tags.
 */
export default function useTags(kind) {
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const key = ITEM_KEY[kind];

  const reload = useCallback(async () => {
    try {
      const data = await fetchTags();
      setTags(Array.isArray(data) ? data : []);
    } catch (err) {
      // The server may not have the tags tables yet; the screens work without tags.
      console.error('Could not load tags', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
    const onUpdate = () => reload();
    socket.on('tags_updated', onUpdate);
    return () => socket.off('tags_updated', onUpdate);
  }, [reload]);

  // id (as string) -> tags that hold it
  const tagsByItem = useMemo(() => {
    const map = new Map();
    tags.forEach((l) => {
      (l[key] || []).forEach((id) => {
        const k = String(id);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(l);
      });
    });
    return map;
  }, [tags, key]);

  const itemIdsOf = useCallback(
    (tagId) => new Set((tags.find((l) => String(l.id) === String(tagId))?.[key] || []).map(String)),
    [tags, key]
  );

  const create = async (name, color) => {
    try {
      const tag = await createTag({ name, color });
      setTags((prev) => [...prev, tag]);
      return tag;
    } catch (err) {
      toast.error(tagErrorMessage(err, "Couldn't create the tag"));
      return null;
    }
  };

  const update = async (id, data) => {
    try {
      const tag = await updateTag(id, data);
      setTags((prev) => prev.map((l) => (l.id === id ? tag : l)));
      return tag;
    } catch (err) {
      toast.error(tagErrorMessage(err, "Couldn't update the tag"));
      return null;
    }
  };

  const remove = async (id) => {
    const before = tags;
    setTags((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteTag(id);
      return true;
    } catch (err) {
      setTags(before);
      toast.error(tagErrorMessage(err, "Couldn't delete the tag"));
      return false;
    }
  };

  const reorder = async (ids) => {
    const before = tags;
    setTags(ids.map((id) => tags.find((l) => l.id === id)).filter(Boolean));
    try {
      await reorderTags(ids);
    } catch (err) {
      setTags(before);
      toast.error(tagErrorMessage(err, "Couldn't reorder your tags"));
    }
  };

  // Put an item in a tag, or take it out (optimistic).
  const toggleItem = async (tagId, itemId, inTag) => {
    const patch = (add) =>
      setTags((prev) =>
        prev.map((l) => {
          if (l.id !== tagId) return l;
          const ids = (l[key] || []).filter((x) => String(x) !== String(itemId));
          return { ...l, [key]: add ? [Number(itemId), ...ids] : ids };
        })
      );
    patch(!inTag);
    try {
      if (inTag) await removeFromTag(tagId, kind, itemId);
      else await addToTag(tagId, kind, itemId);
    } catch (err) {
      patch(inTag);
      toast.error(tagErrorMessage(err, inTag ? "Couldn't remove the tag" : "Couldn't add the tag"));
    }
  };

  return { tags, loaded, reload, tagsByItem, itemIdsOf, create, update, remove, reorder, toggleItem };
}
