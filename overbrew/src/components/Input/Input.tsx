import { useState } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa6'
import './Input.css'

interface InputProps {
  id: string
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'url'
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  placeholder?: string
  isPassword?: boolean
}

const Input = ({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder,
  isPassword = false,
}: InputProps) => {
  const [showPassword, setShowPassword] = useState(false)

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  const inputElement = (
    <input
      id={id}
      name={name}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      required={required}
      type={inputType}
      value={value}
    />
  )

  if (isPassword) {
    return (
      <div className="text-input-group">
        <label htmlFor={id}>{label}</label>
        <div className="password-input-wrapper">
          {inputElement}
          <button
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(!showPassword)}
            type="button"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-input-group">
      <label htmlFor={id}>{label}</label>
      {inputElement}
    </div>
  )
}

export default Input
