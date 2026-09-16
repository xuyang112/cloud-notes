import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom'
import { NotebookProvider } from './store'
import Shell from './components/Shell'
import Home from './pages/Home'
import Article from './pages/Article'
import './styles.css'

const AdminList = lazy(() => import('./pages/Admin').then(module => ({ default: module.AdminList })))
const AdminGuard = lazy(() => import('./pages/Admin').then(module => ({ default: module.AdminGuard })))
const Login = lazy(() => import('./pages/Admin').then(module => ({ default: module.Login })))
const Categories = lazy(() => import('./pages/Admin').then(module => ({ default: module.Categories })))
const EditNote = lazy(() => import('./pages/EditNote'))
const loading = <div className="empty-state" role="status">正在加载工作区…</div>
const guarded = (element: React.ReactNode) => <Suspense fallback={loading}><AdminGuard>{element}</AdminGuard></Suspense>
const router = createBrowserRouter([{
  element: <NotebookProvider><Shell /></NotebookProvider>,
  errorElement: <main className="empty-state"><h1>页面出现异常</h1><p>请刷新后重试。未保存内容可在原编辑窗口中导出。</p><a href="/">返回首页</a></main>,
  children: [
    { index: true, element: <Home /> },
    { path: 'notes/:slug', element: <Article /> },
    { path: 'admin/login', element: <Suspense fallback={loading}><Login /></Suspense> },
    { path: 'admin', element: guarded(<AdminList />) },
    { path: 'admin/categories', element: guarded(<Categories />) },
    { path: 'admin/notes/:id', element: guarded(<EditNote />) },
    { path: '*', element: <main className="empty-state"><h1>页面不存在</h1><Link to="/">返回笔记本</Link></main> },
  ],
}])
const root = import.meta.hot?.data.root || ReactDOM.createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>)
