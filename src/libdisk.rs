use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_ulong};
use libc::statvfs;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::ptr;

#[repr(C)]
pub struct DiskUsage {
    pub total: c_ulong,
    pub free: c_ulong,
    pub used: c_ulong,
}

#[repr(C)]
pub struct MountInfo {
    pub device: *mut c_char,
    pub mount_point: *mut c_char,
}

#[repr(C)]
pub struct MountList {
    pub mounts: *mut MountInfo,
    pub length: usize,
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn get_disk_usage(path: *const c_char) -> *mut DiskUsage {
    if path.is_null() {
        return ptr::null_mut();
    }

    let c_path = CStr::from_ptr(path);
    let mut stat: statvfs = std::mem::zeroed();

    if statvfs(c_path.as_ptr(), &mut stat) != 0 {
        return ptr::null_mut();
    }

    let total = stat.f_blocks * stat.f_frsize;
    let free = stat.f_bfree * stat.f_frsize;
    let used = total - free;

    Box::into_raw(Box::new(DiskUsage { total, free, used }))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn free_disk_usage(ptr: *mut DiskUsage) {
    if !ptr.is_null() {
        let _ = Box::from_raw(ptr);
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn get_mounts() -> *mut MountList {
    let mounts_data = read_mounts();
    let mut mount_infos = Vec::with_capacity(mounts_data.len());

    for (device, mount_point) in mounts_data {
        let device_c = CString::new(device).unwrap().into_raw();
        let mount_point_c = CString::new(mount_point).unwrap().into_raw();
        mount_infos.push(MountInfo { device: device_c, mount_point: mount_point_c });
    }

    let length = mount_infos.len();
    let ptr = mount_infos.as_mut_ptr();
    std::mem::forget(mount_infos);

    let list = Box::new(MountList { mounts: ptr, length });
    Box::into_raw(list)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn free_mounts(list_ptr: *mut MountList) {
    if list_ptr.is_null() {
        return;
    }

    let list = Box::from_raw(list_ptr);
    let mounts_slice = std::slice::from_raw_parts_mut(list.mounts, list.length);

    for mount in mounts_slice {
        if !mount.device.is_null() {
            let _ = CString::from_raw(mount.device);
        }
        if !mount.mount_point.is_null() {
            let _ = CString::from_raw(mount.mount_point);
        }
    }

    let _ = Vec::from_raw_parts(list.mounts, list.length, list.length);
}

fn read_mounts() -> Vec<(String, String)> {
    let file = File::open("/proc/mounts").unwrap();
    let reader = BufReader::new(file);

    reader
        .lines()
        .filter_map(|line| {
            line.ok().and_then(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    Some((parts[0].to_string(), parts[1].to_string()))
                } else {
                    None
                }
            })
        })
        .collect()
}
