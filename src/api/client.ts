import axios from 'axios';
import { message } from 'antd';
import type { Result } from './types';
import { useAuthStore } from '../stores/auth';

const client = axios.create({ baseURL: '/api', timeout: 60000 });

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (resp) => {
    if (resp.config.responseType === 'blob') {
      return resp;
    }
    const result = resp.data as Result<unknown>;
    if (result.code !== 0) {
      if (result.code === 401 && !location.pathname.startsWith('/embed')) {
        useAuthStore.getState().clear();
        if (!location.pathname.startsWith('/login')) {
          message.warning(result.msg || '请先登录');
          location.href = '/login';
        }
      } else {
        message.error(result.msg || '请求失败');
      }
      return Promise.reject(new Error(result.msg));
    }
    return result.data as any;
  },
  (error) => {
    message.error(error?.message || '网络错误');
    return Promise.reject(error);
  },
);

// 统一返回 axios 拦截器已解包 data
export default client as unknown as {
  get<T = any>(url: string, config?: any): Promise<T>;
  post<T = any>(url: string, data?: any, config?: any): Promise<T>;
  put<T = any>(url: string, data?: any, config?: any): Promise<T>;
  delete<T = any>(url: string, config?: any): Promise<T>;
};
