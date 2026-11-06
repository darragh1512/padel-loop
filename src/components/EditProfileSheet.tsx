"use client";

// Editing your own profile: photo, name, level, home club and bio.
//
// A new photo uploads as soon as it's picked but only reaches your profile when
// you save. Removing a photo is immediate, so it asks first.

import { useCallback, useRef, useState } from "react";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import Sheet, { useSheetClosing } from "@/components/ios/Sheet";
import { publishAvatarChange } from "@/lib/avatarBus";
import { removeAvatar, savePlayerProfile, SKILL_LEVELS, uploadAvatar, type Profile } from "@/app/profiles";

export default function EditProfileSheet({
  profile,
  onClose,
  onChanged,
}: {
  profile: Profile;
  onClose: () => void;
  onChanged: (patch: Partial<Profile>) => void;
}) {
  const playerId = profile.id;
  const [name, setName] = useState(profile.name ?? "");
  const [skill, setSkill] = useState<string>(profile.skill_level || SKILL_LEVELS[0]);
  const [club, setClub] = useState(profile.home_club ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [photo, setPhoto] = useState<string | null>(profile.avatar_url ?? null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  function edited<T>(set: (value: T) => void) {
    return (value: T) => {
      setTouched(true);
      set(value);
    };
  }

  function requestClose() {
    if (touched) setConfirmingDiscard(true);
    else close();
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    const result = await uploadAvatar(playerId, file);
    if ("url" in result) {
      setTouched(true);
      setPhoto(result.url);
    } else {
      setError("Couldn’t upload that photo. Try again.");
    }
    setUploading(false);
  }

  async function handleRemovePhoto() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    const result = await removeAvatar(playerId);
    if ("ok" in result) {
      setPhoto(null);
      onChanged({ avatar_url: null });
      // Nudge the screens that kept the old photo.
      publishAvatarChange({ userId: playerId, avatarUrl: null });
      setConfirmingRemove(false);
    } else {
      // Nothing changed: their photo is still there and still works.
      setError("Couldn’t remove that photo. Try again.");
      setConfirmingRemove(false);
    }
    setRemoving(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await savePlayerProfile(playerId, {
      name,
      skill_level: skill,
      home_club: club,
      bio,
      avatar_url: photo,
    });
    if ("ok" in result) {
      onChanged({ name, skill_level: skill, home_club: club, bio, avatar_url: photo });
      // A newly uploaded photo only reaches the database here.
      publishAvatarChange({ userId: playerId, avatarUrl: photo });
      close();
    } else {
      setError("Couldn’t save your changes. Try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Edit Profile"
      left={{ label: "Cancel", onPress: requestClose }}
      right={{ label: "Save", onPress: handleSave, busy: saving, disabled: uploading }}
      closing={closing}
      onRequestClose={requestClose}
      after={
        <>
          <Alert
            open={confirmingRemove}
            onClose={() => {
              if (!removing) setConfirmingRemove(false);
            }}
            title="Remove Your Photo?"
            actions={[
              { label: "Keep Photo", bold: true, disabled: removing, onPress: () => setConfirmingRemove(false) },
              { label: "Remove", destructive: true, busy: removing, onPress: handleRemovePhoto },
            ]}
          >
            Your photo will be deleted and your initials will show instead. You can upload a new one any time.
          </Alert>
          <Alert
            open={confirmingDiscard}
            onClose={() => setConfirmingDiscard(false)}
            title="Discard Your Changes?"
            actions={[
              { label: "Keep Editing", bold: true, onPress: () => setConfirmingDiscard(false) },
              {
                label: "Discard",
                destructive: true,
                onPress: () => {
                  setConfirmingDiscard(false);
                  close();
                },
              },
            ]}
          />
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 14 }}>
        <Monogram name={name || profile.name} photoUrl={photo} size={84} />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="ios-pill-tint ios-press"
            disabled={uploading}
            aria-busy={uploading || undefined}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "Uploading…" : "Change Photo"}
          </button>
          {photo && (
            <button
              type="button"
              className="ios-pill-tint ios-press"
              data-destructive
              disabled={uploading}
              onClick={() => setConfirmingRemove(true)}
            >
              Remove Photo
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" onChange={handlePickFile} hidden />
      </div>

      <div className="ios-list" style={{ marginTop: 14 }}>
        <label className="ios-row ios-sheet-row" style={{ "--ios-inset": "16px" } as React.CSSProperties}>
          <span className="ios-bd">Name</span>
          <input
            className="ios-field"
            value={name}
            placeholder="Your name"
            onChange={(e) => edited(setName)(e.target.value)}
          />
        </label>
        <label className="ios-row ios-sheet-row" style={{ "--ios-inset": "16px" } as React.CSSProperties}>
          <span className="ios-bd ios-grow">Level</span>
          <span className="ios-bd ios-sec">{skill}</span>
          <span className="ios-chev">
            <Icon name="updown" size={15} />
          </span>
          <select
            className="ios-native-over"
            aria-label="Level"
            value={skill}
            onChange={(e) => edited(setSkill)(e.target.value)}
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="ios-row ios-sheet-row" style={{ "--ios-inset": "16px" } as React.CSSProperties}>
          <span className="ios-bd" style={{ whiteSpace: "nowrap" }}>Home Club</span>
          <input
            className="ios-field"
            value={club}
            placeholder="Optional"
            onChange={(e) => edited(setClub)(e.target.value)}
          />
        </label>
      </div>

      <div className="ios-list" style={{ marginTop: 12 }}>
        <textarea
          className="ios-textarea"
          value={bio}
          rows={3}
          placeholder="A line or two about your game. (Optional)"
          aria-label="Bio"
          onChange={(e) => edited(setBio)(e.target.value)}
        />
      </div>

      {error && (
        <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </div>
      )}
    </Sheet>
  );
}
