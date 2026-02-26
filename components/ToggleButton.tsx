"use client";

import * as React from "react";

interface ToggleButtonProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "default" | "inverted" | "danger";
  invertColors?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  className = "",
  invertColors = false,
  variant = "default",
}) => {
  const [isChecked, setIsChecked] = React.useState(checked);

  React.useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  const handleToggle = () => {
    if (disabled) return;

    const newChecked = !isChecked;
    setIsChecked(newChecked);
    onChange?.(newChecked);
  };

  const sizeClasses = {
    sm: "w-8 h-4",
    md: "w-12 h-6",
    lg: "w-16 h-8"
  };

  const dotSizeClasses = {
    sm: "w-3 h-3",
    md: "w-5 h-5",
    lg: "w-7 h-7"
  };

  const translateClasses = {
    sm: isChecked ? "translate-x-4" : "translate-x-0.5",
    md: isChecked ? "translate-x-6" : "translate-x-0.5",
    lg: isChecked ? "translate-x-8" : "translate-x-0.5"
  };

  // Determine colors based on variant/invertColors
  let bgColorClass = "";
  if (variant === "danger") {
    bgColorClass = isChecked ? "bg-red-600 hover:bg-red-700" : "bg-gray-300 hover:bg-gray-400";
  } else if (invertColors || variant === "inverted") {
    bgColorClass = isChecked ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600";
  } else {
    // Default
    bgColorClass = isChecked ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600";
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={`
        relative inline-flex flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${sizeClasses[size]}
        ${bgColorClass}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      role="switch"
      aria-checked={isChecked}
    >
      <span className="sr-only">Toggle</span>
      <span
        className={`
          pointer-events-none relative inline-block transform rounded-full
          bg-white shadow transition-transform duration-200 ease-in-out
          ${dotSizeClasses[size]}
          ${translateClasses[size]}
        `}
      />
    </button>
  );
};
