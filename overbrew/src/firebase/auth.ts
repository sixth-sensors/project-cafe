import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './config'

export const registerWithEmail = async (email: string, password: string) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  await sendEmailVerification(user)
  return user
}

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password)

export const signInWithGoogle = () =>
  signInWithPopup(auth, new GoogleAuthProvider())

export const logOut = () => signOut(auth)

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email)

export const changePassword = (user: User, newPassword: string) =>
  updatePassword(user, newPassword)

export const updateUserProfile = (
  user: User,
  displayName: string,
  photoURL?: string
) => updateProfile(user, { displayName, photoURL })

export const updateUserEmail = (user: User, newEmail: string) =>
  updateEmail(user, newEmail)

export const reauthenticate = (user: User, password: string) => {
  const credential = EmailAuthProvider.credential(user.email!, password)
  return reauthenticateWithCredential(user, credential)
}

export const deleteAccount = async (user: User, password: string) => {
  await reauthenticate(user, password)
  return deleteUser(user)
}

export const subscribeToAuthChanges = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)
