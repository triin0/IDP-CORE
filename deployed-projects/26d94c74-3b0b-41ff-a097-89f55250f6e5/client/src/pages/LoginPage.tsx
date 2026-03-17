import React, { useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

function LoginPage(): JSX.Element {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, error } = useAuth();

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (isLogin) {
      login.mutate({ email, password });
    } else {
      register.mutate({ email, password });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl mb-6 text-center font-bold">{isLogin ? 'Login' : 'Register'}</h2>
        {error && <p className="text-red-500 text-xs italic mb-4">{error.message}</p>}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
            id="password" type="password" placeholder="******************" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit">
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800">
            {isLogin ? 'Need an account?' : 'Already have an account?'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
