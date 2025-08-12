import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

const USERNAME = 'trmthanh220895@gmail.com';
const PASSWORD = 'Minhthanh220895@';
const DEFAULT_FOLDER = 'upload_images';
const BASE_URL = 'https://api.pcloud.com';

let _authToken: string | null = null;

@Injectable()
export class upload_Pcloud {
  private async pcloudLogin(): Promise<string> {
    if (_authToken) return _authToken;

    const res = await axios.get(`${BASE_URL}/login`, {
      params: {
        getauth: 1,
        username: USERNAME,
        password: PASSWORD,
      },
    });

    if (res.data.result !== 0) {
      throw new Error(`Login failed: ${res.data.error}`);
    }

    _authToken = res.data.auth;
    return _authToken;
  }

  private async getFolderId(auth: string, folderName: string): Promise<number> {
    const listRes = await axios.get(`${BASE_URL}/listfolder`, {
      params: { auth, folderid: 0 },
    });

    for (const item of listRes.data.metadata.contents || []) {
      if (item.isfolder && item.name === folderName) {
        return item.folderid;
      }
    }

    const createRes = await axios.get(`${BASE_URL}/createfolder`, {
      params: { auth, name: folderName, folderid: 0 },
    });

    if (createRes.data.result !== 0) {
      throw new Error(`Create folder failed: ${createRes.data.error}`);
    }

    return createRes.data.metadata.folderid;
  }

  private async getFileLinks(auth: string, fileid: number): Promise<{ publink: string; directLink: string }> {
    const publinkRes = await axios.get(`${BASE_URL}/getfilepublink`, {
      params: { auth, fileid },
    });

    const publink = publinkRes.data.result === 0 ? publinkRes.data.link : null;

    const filelinkRes = await axios.get(`${BASE_URL}/getfilelink`, {
      params: { auth, fileid },
    });

    let directLink = null;
    if (filelinkRes.data.result === 0) {
      const host = filelinkRes.data.hosts[0];
      const path = filelinkRes.data.path;
      directLink = `https://${host}${path}`;
    }

    return { publink, directLink };
  }

  async uploadImageBufferToPCloud(
    buffer: Buffer,
    fileName: string,
    folderName: string = DEFAULT_FOLDER,
  ): Promise<any> {
    const auth = await this.pcloudLogin();
    const folderId = await this.getFolderId(auth, folderName);

    const listRes = await axios.get(`${BASE_URL}/listfolder`, {
      params: { auth, folderid: folderId },
    });

    const existingFiles = (listRes.data.metadata.contents || [])
      .filter((item) => !item.isfolder)
      .map((item) => item.name);

    let finalFileName = fileName;
    if (existingFiles.includes(fileName)) {
      const ext = fileName.split('.').pop();
      const filenameNoExt = fileName.replace(`.${ext}`, '');
      const uniqueSuffix = Date.now();
      finalFileName = `${filenameNoExt}_${uniqueSuffix}.${ext}`;
    }

    const form = new FormData();
    form.append('auth', auth);
    form.append('folderid', folderId);
    form.append('file', buffer, finalFileName);

    const uploadRes = await axios.post(`${BASE_URL}/uploadfile`, form, {
      headers: form.getHeaders(),
    });

    if (uploadRes.data.result !== 0) {
      return { error: 'Upload failed', detail: uploadRes.data.error };
    }

    const uploaded = uploadRes.data.metadata[0];
    const { publink, directLink } = await this.getFileLinks(auth, uploaded.fileid);

    return {
      name: uploaded.name,
      size_kb: (uploaded.size / 1024).toFixed(2),
      fileid: uploaded.fileid,
      publink,
      direct_link: directLink,
    };
  }

  async deleteImage(fileid: number): Promise<any> {
    const auth = await this.pcloudLogin();
    const res = await axios.get(`${BASE_URL}/deletefile`, {
      params: { auth, fileid },
    });

    if (res.data.result !== 0) {
      throw new Error(`Delete failed: ${res.data.error}`);
    }
    return { success: true, message: 'File deleted successfully' };
  }

  async updateImage(
    oldFileId: number,
    newBuffer: Buffer,
    newFileName: string,
    folderName: string = DEFAULT_FOLDER,
  ): Promise<any> {
    await this.deleteImage(oldFileId);
    return await this.uploadImageBufferToPCloud(newBuffer, newFileName, folderName);
  }

  async getAllImages(folderName: string = DEFAULT_FOLDER): Promise<any[]> {
    const auth = await this.pcloudLogin();
    const folderId = await this.getFolderId(auth, folderName);

    const listRes = await axios.get(`${BASE_URL}/listfolder`, {
      params: { auth, folderid: folderId },
    });

    if (listRes.data.result !== 0) {
      throw new Error(`List folder failed: ${listRes.data.error}`);
    }

    const files = listRes.data.metadata.contents || [];
    const results = [];

    for (const file of files) {
      if (!file.isfolder) {
        const { publink, directLink } = await this.getFileLinks(auth, file.fileid);
        results.push({
          name: file.name,
          size_kb: (file.size / 1024).toFixed(2),
          fileid: file.fileid,
          modified: file.modified,
          publink,
          direct_link: directLink,
        });
      }
    }

    return results;
  }
}



// import { Injectable } from '@nestjs/common';
// import axios from 'axios';
// import * as FormData from 'form-data';

// const USERNAME = 'trmthanh220895@gmail.com';
// const PASSWORD = 'Minhthanh220895@';
// const DEFAULT_FOLDER = 'upload_images';
// const BASE_URL = 'https://api.pcloud.com';

// let _authToken: string | null = null;

// @Injectable()
// export class upload_Pcloud {
//   private async pcloudLogin(): Promise<string> {
//     if (_authToken) return _authToken;

//     const res = await axios.get(`${BASE_URL}/login`, {
//       params: {
//         getauth: 1,
//         username: USERNAME,
//         password: PASSWORD,
//       },
//     });

//     if (res.data.result !== 0) {
//       throw new Error(`Login failed: ${res.data.error}`);
//     }

//     _authToken = res.data.auth;
//     return _authToken;
//   }

//   private async getFolderId(auth: string, folderName: string): Promise<number> {
//     const listRes = await axios.get(`${BASE_URL}/listfolder`, {
//       params: { auth, folderid: 0 },
//     });

//     for (const item of listRes.data.metadata.contents || []) {
//       if (item.isfolder && item.name === folderName) {
//         return item.folderid;
//       }
//     }

//     const createRes = await axios.get(`${BASE_URL}/createfolder`, {
//       params: { auth, name: folderName, folderid: 0 },
//     });

//     if (createRes.data.result !== 0) {
//       throw new Error(`Create folder failed: ${createRes.data.error}`);
//     }

//     return createRes.data.metadata.folderid;
//   }

//   private async getFileLinks(auth: string, fileid: number): Promise<{ publink: string; directLink: string }> {
//     const publinkRes = await axios.get(`${BASE_URL}/getfilepublink`, {
//       params: { auth, fileid },
//     });

//     const publink = publinkRes.data.result === 0 ? publinkRes.data.link : null;

//     const filelinkRes = await axios.get(`${BASE_URL}/getfilelink`, {
//       params: { auth, fileid },
//     });

//     let directLink = null;
//     if (filelinkRes.data.result === 0) {
//       const host = filelinkRes.data.hosts[0];
//       const path = filelinkRes.data.path;
//       directLink = `https://${host}${path}`;
//     }

//     return { publink, directLink };
//   }

//   async uploadImageBufferToPCloud(
//     buffer: Buffer,
//     fileName: string,
//     folderName: string = DEFAULT_FOLDER,
//   ): Promise<any> {
//     const auth = await this.pcloudLogin();
//     const folderId = await this.getFolderId(auth, folderName);

//     // Lấy danh sách file trong folder để check trùng tên
//     const listRes = await axios.get(`${BASE_URL}/listfolder`, {
//       params: { auth, folderid: folderId },
//     });

//     const existingFiles = (listRes.data.metadata.contents || [])
//       .filter((item) => !item.isfolder)
//       .map((item) => item.name);

//     let finalFileName = fileName;
//     if (existingFiles.includes(fileName)) {
//       const ext = fileName.split('.').pop();
//       const filenameNoExt = fileName.replace(`.${ext}`, '');
//       const uniqueSuffix = Date.now();
//       finalFileName = `${filenameNoExt}_${uniqueSuffix}.${ext}`;
//     }

//     const form = new FormData();
//     form.append('auth', auth);
//     form.append('folderid', folderId);
//     form.append('file', buffer, finalFileName);

//     const uploadRes = await axios.post(`${BASE_URL}/uploadfile`, form, {
//       headers: form.getHeaders(),
//     });

//     if (uploadRes.data.result !== 0) {
//       return { error: 'Upload failed', detail: uploadRes.data.error };
//     }

//     const uploaded = uploadRes.data.metadata[0];
//     const { publink, directLink } = await this.getFileLinks(auth, uploaded.fileid);

//     return {
//       name: uploaded.name,
//       size_kb: (uploaded.size / 1024).toFixed(2),
//       fileid: uploaded.fileid,
//       publink,
//       direct_link: directLink,
//     };
//   }
// }



// import { Injectable } from '@nestjs/common';
// import axios from 'axios';
// import * as FormData from 'form-data';
// import * as fs from 'fs';

// const USERNAME = 'trmthanh220895@gmail.com';
// const PASSWORD = 'Minhthanh220895@';
// const DEFAULT_FOLDER = 'upload_images';
// const BASE_URL = 'https://api.pcloud.com';

// let _authToken: string | null = null;

// @Injectable()
// export class PCloudService {
//   // 🔐 Đăng nhập & Cache token
//   private async pcloudLogin(): Promise<string> {
//     if (_authToken) return _authToken;

//     const res = await axios.get(`${BASE_URL}/login`, {
//       params: {
//         getauth: 1,
//         username: USERNAME,
//         password: PASSWORD,
//       },
//     });

//     if (res.data.result !== 0) {
//       throw new Error(`Login failed: ${res.data.error}`);
//     }

//     _authToken = res.data.auth;
//     return _authToken;
//   }

//   // 📁 Kiểm tra Folder (nếu chưa có thì tạo mới)
//   private async getFolderId(auth: string, folderName: string): Promise<number> {
//     const listRes = await axios.get(`${BASE_URL}/listfolder`, {
//       params: { auth, folderid: 0 },
//     });

//     for (const item of listRes.data.metadata.contents || []) {
//       if (item.isfolder && item.name === folderName) {
//         return item.folderid;
//       }
//     }

//     const createRes = await axios.get(`${BASE_URL}/createfolder`, {
//       params: { auth, name: folderName, folderid: 0 },
//     });

//     if (createRes.data.result !== 0) {
//       throw new Error(`Create folder failed: ${createRes.data.error}`);
//     }

//     return createRes.data.metadata.folderid;
//   }

//   // 🌐 Lấy Public Link + Direct Link
//   private async getFileLinks(auth: string, fileid: number): Promise<{ publink: string; directLink: string }> {
//     const publinkRes = await axios.get(`${BASE_URL}/getfilepublink`, {
//       params: { auth, fileid },
//     });

//     const publink = publinkRes.data.result === 0 ? publinkRes.data.link : null;

//     const filelinkRes = await axios.get(`${BASE_URL}/getfilelink`, {
//       params: { auth, fileid },
//     });

//     let directLink = null;
//     if (filelinkRes.data.result === 0) {
//       const host = filelinkRes.data.hosts[0];
//       const path = filelinkRes.data.path;
//       directLink = `https://${host}${path}`;
//     }

//     return { publink, directLink };
//   }

//   // 🚀 Upload file lên pCloud
//   async uploadImageToPCloud(filePath: string, fileName?: string, folderName: string = DEFAULT_FOLDER): Promise<any> {
//     const auth = await this.pcloudLogin();
//     const folderId = await this.getFolderId(auth, folderName);

//     const fileBaseName = fileName || filePath.split('/').pop();
//     const [filenameNoExt, ext] = fileBaseName.split('.');

//     // Kiểm tra tên file đã tồn tại chưa
//     const listRes = await axios.get(`${BASE_URL}/listfolder`, {
//       params: { auth, folderid: folderId },
//     });

//     const existingFiles = (listRes.data.metadata.contents || []).filter((item) => !item.isfolder).map((item) => item.name);

//     let finalFileName = fileBaseName;
//     if (existingFiles.includes(fileBaseName)) {
//       const uniqueSuffix = Date.now();
//       finalFileName = `${filenameNoExt}_${uniqueSuffix}.${ext}`;
//     }

//     const form = new FormData();
//     form.append('auth', auth);
//     form.append('folderid', folderId);
//     form.append('file', fs.createReadStream(filePath), finalFileName);

//     const uploadRes = await axios.post(`${BASE_URL}/uploadfile`, form, {
//       headers: form.getHeaders(),
//     });

//     if (uploadRes.data.result !== 0) {
//       return { error: 'Upload failed', detail: uploadRes.data.error };
//     }

//     const uploaded = uploadRes.data.metadata[0];
//     const { publink, directLink } = await this.getFileLinks(auth, uploaded.fileid);

//     return {
//       name: uploaded.name,
//       size_kb: (uploaded.size / 1024).toFixed(2),
//       fileid: uploaded.fileid,
//       publink,
//       direct_link: directLink,
//     };
//   }
// }
















// Python


// import time
// import requests

// USERNAME = "trmthanh220895@gmail.com"
// PASSWORD = "Minhthanh220895@"
// DEFAULT_FOLDER = "upload_images"
// BASE_URL = "https://api.pcloud.com"

// _auth_token = None  # 🔒 Cache token in memory to avoid login every request

// def pcloud_login():
//     global _auth_token
//     if _auth_token:
//         return _auth_token
//     res = requests.get(f"{BASE_URL}/login", params={
//         "getauth": 1,
//         "username": USERNAME,
//         "password": PASSWORD
//     }).json()
//     if res.get("result") != 0:
//         raise Exception(f"Login failed: {res.get('error')}")
//     _auth_token = res["auth"]
//     return _auth_token

// def get_folder_id(auth, folder_name):
//     list_res = requests.get(f"{BASE_URL}/listfolder", params={"auth": auth, "folderid": 0}).json()
//     for item in list_res.get("metadata", {}).get("contents", []):
//         if item.get("isfolder") and item.get("name") == folder_name:
//             return item["folderid"]
//     create_res = requests.get(f"{BASE_URL}/createfolder", params={
//         "auth": auth, "name": folder_name, "folderid": 0
//     }).json()
//     if create_res.get("result") != 0:
//         raise Exception(f"Create folder failed: {create_res.get('error')}")
//     return create_res["metadata"]["folderid"]

// def get_file_links(auth, fileid):
//     publink_res = requests.get(f"{BASE_URL}/getfilepublink", params={"auth": auth, "fileid": fileid}).json()
//     publink = publink_res.get("link") if publink_res.get("result") == 0 else None

//     filelink_res = requests.get(f"{BASE_URL}/getfilelink", params={"auth": auth, "fileid": fileid}).json()
//     direct_link = None
//     if filelink_res.get("result") == 0:
//         host = filelink_res["hosts"][0]
//         path = filelink_res["path"]
//         direct_link = f"https://{host}{path}"

//     return publink, direct_link

// def upload_image_to_pcloud(file_obj, file_name=None, folder_name=DEFAULT_FOLDER):
//     auth = pcloud_login()
//     folder_id = get_folder_id(auth, folder_name)

//     file_name = file_name or getattr(file_obj, 'name', 'uploaded.jpg')
//     filename_no_ext, ext = file_name.rsplit('.', 1)

//     # Check unique name
//     list_res = requests.get(f"{BASE_URL}/listfolder", params={"auth": auth, "folderid": folder_id}).json()
//     existing_files = [item.get('name') for item in list_res.get("metadata", {}).get("contents", []) if not item.get('isfolder')]
//     if file_name in existing_files:
//         unique_suffix = str(int(time.time()))
//         file_name = f"{filename_no_ext}_{unique_suffix}.{ext}"

//     # Upload file (Streaming)
//     upload_res = requests.post(f"{BASE_URL}/uploadfile",
//         data={'auth': auth, 'folderid': folder_id},
//         files={'file': (file_name, file_obj)}
//     ).json()

//     if upload_res.get("result") != 0:
//         return {'error': 'Upload failed', 'detail': upload_res.get("error")}

//     uploaded = upload_res['metadata'][0]
//     publink, direct_link = get_file_links(auth, uploaded['fileid'])

//     return {
//         'name': uploaded['name'],
//         'size_kb': round(uploaded['size'] / 1024, 2),
//         'fileid': uploaded['fileid'],
//         'publink': publink,
//         'direct_link': direct_link
//     }