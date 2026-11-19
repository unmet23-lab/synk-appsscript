//! The host supplies these four stable Node-API functions. Looking them up in
//! the current executable works for both branded Electron names; a missing
//! export leaves the optional module unavailable without aborting the host.
use std::{
    ffi::{c_char, c_void},
    ptr,
    sync::OnceLock,
};
use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};

type Env = *mut c_void;
type Value = *mut c_void;
type Info = *mut c_void;
type Callback = unsafe extern "C" fn(Env, Info) -> Value;
type CreateFunction =
    unsafe extern "C" fn(Env, *const c_char, usize, Callback, *mut c_void, *mut Value) -> i32;
type GetArgs =
    unsafe extern "C" fn(Env, Info, *mut usize, *mut Value, *mut Value, *mut *mut c_void) -> i32;
type ReadString = unsafe extern "C" fn(Env, Value, *mut c_char, usize, *mut usize) -> i32;
type CreateNumber = unsafe extern "C" fn(Env, u32, *mut Value) -> i32;

struct Api {
    function: CreateFunction,
    args: GetArgs,
    string: ReadString,
    number: CreateNumber,
}

impl Api {
    fn load() -> Option<Self> {
        // The Windows main image is resident for the lifetime of this module.
        let host = unsafe { GetModuleHandleW(ptr::null()) };
        if host.is_null() {
            return None;
        }
        macro_rules! export {
            ($name:literal, $signature:ty) => {
                unsafe {
                    std::mem::transmute::<unsafe extern "system" fn() -> isize, $signature>(
                        GetProcAddress(host, concat!($name, "\0").as_ptr())?,
                    )
                }
            };
        }
        Some(Self {
            function: export!("napi_create_function", CreateFunction),
            args: export!("napi_get_cb_info", GetArgs),
            string: export!("napi_get_value_string_utf8", ReadString),
            number: export!("napi_create_uint32", CreateNumber),
        })
    }

    unsafe fn read_command(&self, env: Env, info: Info) -> Option<String> {
        let mut count = 1;
        let mut arg = ptr::null_mut();
        if (self.args)(
            env,
            info,
            &mut count,
            &mut arg,
            ptr::null_mut(),
            ptr::null_mut(),
        ) != 0
            || count != 1
        {
            return None;
        }
        let mut len = 0;
        if (self.string)(env, arg, ptr::null_mut(), 0, &mut len) != 0 || !(1..=8192).contains(&len)
        {
            return None;
        }
        let mut data = vec![0u8; len + 1];
        let mut copied = 0;
        if (self.string)(env, arg, data.as_mut_ptr().cast(), data.len(), &mut copied) != 0
            || copied != len
        {
            return None;
        }
        data.truncate(copied);
        String::from_utf8(data).ok()
    }
}

static API: OnceLock<Option<Api>> = OnceLock::new();

unsafe extern "C" fn dispatch(env: Env, info: Info) -> Value {
    let Some(Some(api)) = API.get() else {
        return ptr::null_mut();
    };
    let status = api
        .read_command(env, info)
        .map_or(super::FAILED, |input| super::command(&input));
    let mut result = ptr::null_mut();
    if (api.number)(env, status, &mut result) == 0 {
        result
    } else {
        ptr::null_mut()
    }
}

#[no_mangle]
pub unsafe extern "C" fn napi_register_module_v1(env: Env, exports: Value) -> Value {
    let Some(api) = API.get_or_init(Api::load) else {
        return exports;
    };
    let mut function = ptr::null_mut();
    let label = b"trayMemory";
    if (api.function)(
        env,
        label.as_ptr().cast(),
        label.len(),
        dispatch,
        ptr::null_mut(),
        &mut function,
    ) == 0
    {
        function
    } else {
        exports
    }
}
