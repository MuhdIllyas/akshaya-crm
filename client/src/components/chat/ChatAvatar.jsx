import React, { useState, useEffect } from "react";
import { FiUsers } from "react-icons/fi";
import { initials } from "./chatUtils";

const SIZES = {
  xs: { box: "w-6 h-6 text-[10px]", icon: 12, dot: "w-2 h-2" },
  sm: { box: "w-8 h-8 text-xs", icon: 14, dot: "w-2.5 h-2.5" },
  md: { box: "w-10 h-10 text-sm", icon: 18, dot: "w-3 h-3" },
  lg: { box: "w-12 h-12 text-base", icon: 20, dot: "w-3 h-3" },
  xl: { box: "w-20 h-20 text-2xl", icon: 30, dot: "w-4 h-4" },
};

/**
 * Round avatar: photo -> initials -> group/custom icon.
 * `online` true/false draws a status dot; leave undefined to hide it.
 */
const ChatAvatar = ({
  name,
  photo,
  size = "md",
  color = "bg-navy-700",
  isGroup = false,
  icon: Icon,
  online,
  className = "",
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);

  const s = SIZES[size] || SIZES.md;
  const showPhoto = photo && !failed;

  return (
    <div className={`relative shrink-0 ${className}`}>
      {showPhoto ? (
        <img
          src={photo}
          alt={name || ""}
          onError={() => setFailed(true)}
          className={`${s.box} rounded-full object-cover ring-1 ring-black/5`}
        />
      ) : (
        <div
          className={`${s.box} rounded-full ${color} text-white font-semibold flex items-center justify-center select-none`}
        >
          {isGroup ? <FiUsers size={s.icon} /> : Icon ? <Icon size={s.icon} /> : initials(name)}
        </div>
      )}
      {(online === true || online === false) && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white ${s.dot} ${
            online ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      )}
    </div>
  );
};

export default ChatAvatar;