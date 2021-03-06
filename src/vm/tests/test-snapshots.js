// Copyright 2012 Joyent, Inc.  All rights reserved.

process.env['TAP'] = 1;
var async = require('/usr/node/node_modules/async');
var cp = require('child_process');
var execFile = cp.execFile;
var fs = require('fs');
var path = require('path');
var test = require('tap').test;
var VM = require('/usr/vm/node_modules/VM');
var vmtest = require('../common/vmtest.js');

VM.loglevel = 'DEBUG';

var abort = false;
var bundle_filename;
var vmobj;

var MAGIC_STRING1 = 'snapshots are so much fun for everyone!';
var MAGIC_STRING2 = 'snapshots get more fun the more you do!';
var MAGIC_STRING3 = 'the third snapshot is yet even more fun!';

var image_uuid = vmtest.CURRENT_SMARTOS_UUID;
var sngl_image_uuid = vmtest.CURRENT_SNGL_UUID;
var vm_image_uuid = vmtest.CURRENT_UBUNTU_UUID;

// TODO: test that order is correct on resulting .snapshots member

function hasSnapshot(snapshots, snapname)
{
    var snap;

    for (snap in snapshots) {
        if (snapshots[snap].name === snapname) {
            return true;
        }
    }

    return false;
}

// This will ensure vmtest.CURRENT_* are installed
vmtest.ensureCurrentImages();

// create VM try to snapshot, should fail

test('create zone with delegated dataset', {'timeout': 240000}, function(t) {
    var payload = {
        'brand': 'joyent-minimal',
        'autoboot': false,
        'image_uuid': image_uuid,
        'alias': 'test-snapshot-' + process.pid,
        'do_not_inventory': true,
        'delegate_dataset': true
    };

    VM.create(payload, function (err, obj) {
        if (err) {
            t.ok(false, 'error creating VM: ' + err.message);
            t.end();
        } else {
            t.ok(true, 'VM created with uuid ' + obj.uuid);
            VM.load(obj.uuid, function (e, o) {
                t.ok(!err, 'loading VM after create');
                if (!err) {
                    t.ok(o.snapshots.length === 0, 'no snapshots after create');
                    t.ok(o.hasOwnProperty('zfs_filesystem'),
                        'has zfs_filesystem');
                    vmobj = o;
                } else {
                    abort = true;
                }
                t.end();
            });
        }
    });
});

test('create snapshot that should fail on zone with delegated dataset', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping snapshot as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
        t.ok(err, 'error creating snapshot1 of ' + vmobj.uuid);
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (!e) {
                t.ok(o.snapshots.length === 0, '0 snapshots after create');
            } else {
                abort = true;
            }
            t.end();
        });
    });
});

test('delete zone', function(t) {
    if (abort) {
        t.ok(false, 'skipping send as test run is aborted.');
        t.end();
        return;
    }
    if (vmobj.uuid) {
        VM.delete(vmobj.uuid, function (err) {
            if (err) {
                t.ok(false, 'error deleting VM: ' + err.message);
                abort = true;
            } else {
                t.ok(true, 'deleted VM: ' + vmobj.uuid);
            }
            t.end();
            vmobj = {};
        });
    } else {
        t.ok(false, 'no VM to delete');
        abort = true;
        t.end();
    }
});

// create zone with delegated dataset try to snapshot, should fail

test('create KVM VM', {'timeout': 240000}, function(t) {
    var payload = {
        'brand': 'kvm',
        'autoboot': false,
        'alias': 'test-snapshot-' + process.pid,
        'do_not_inventory': true,
        'ram': 128,
        'disks': [{
            'size': 5120,
            'model': 'virtio'
        }]
    };

    VM.create(payload, function (err, obj) {
        if (err) {
            t.ok(false, 'error creating VM: ' + err.message);
            t.end();
        } else {
            t.ok(true, 'VM created with uuid ' + obj.uuid);
            VM.load(obj.uuid, function (e, o) {
                t.ok(!err, 'loading VM after create');
                if (!err) {
                    t.ok(o.snapshots.length === 0, 'VM has no snapshots');
                    vmobj = o;
                } else {
                    abort = true;
                }
                t.end();
            });
        }
    });
});

test('create snapshot that should fail on kvm', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping snapshot as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
        t.ok(err, 'error creating snapshot1 of ' + vmobj.uuid);
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (!e) {
                t.ok(o.snapshots.length === 0, '0 snapshots after create');
            } else {
                abort = true;
            }
            t.end();
        });
    });
});

test('delete vm', function(t) {
    if (abort) {
        t.ok(false, 'skipping send as test run is aborted.');
        t.end();
        return;
    }
    if (vmobj.uuid) {
        VM.delete(vmobj.uuid, function (err) {
            if (err) {
                t.ok(false, 'error deleting VM: ' + err.message);
                abort = true;
            } else {
                t.ok(true, 'deleted VM: ' + vmobj.uuid);
            }
            t.end();
        });
    } else {
        t.ok(false, 'no VM to delete');
        abort = true;
        t.end();
    }
});

//    create snapshot
//    snapshot count == 1
//    replace data
//    create second snapshot
//    snapshot count == 2
//    rollback to snapshot1
//    read data
//    rollback to snapshot2
//    read data
//    delete snapshot1
//    snapshot count == 1
//    delete snapshot2
//    snapshot count == 0
//    create 100 snapshots
//    delete 100 snapshots


test('create normal zone', {'timeout': 240000}, function(t) {
    var payload = {
        'brand': 'joyent-minimal',
        'autoboot': true,
        'image_uuid': image_uuid,
        'alias': 'test-snapshot-' + process.pid,
        'do_not_inventory': true
    };

    VM.create(payload, function (err, obj) {
        if (err) {
            t.ok(false, 'error creating VM: ' + err.message);
            t.end();
        } else {
            t.ok(true, 'VM created with uuid ' + obj.uuid);
            VM.load(obj.uuid, function (e, o) {
                t.ok(!err, 'loading VM after create');
                if (!err) {
                    t.ok(o.snapshots.length === 0, 'no snapshots after create');
                    t.ok(o.hasOwnProperty('zfs_filesystem'),
                        'has zfs_filesystem');
                    vmobj = o;
                } else {
                    abort = true;
                }
                t.end();
            });
        }
    });
});

test('create snapshot without vmsnap name and it should not show up', {'timeout': 240000}, function(t) {

    var dataset = vmobj.zfs_filesystem;
    var snapshot = dataset + '@manual-snapshot';

    execFile('/usr/sbin/zfs', ['snapshot', snapshot], function (error) {
        t.ok(!error, 'created manual snapshot' + (error ? ': ' + error.message : ''));
        if (!error) {
            execFile('/usr/sbin/zfs', ['list', '-t', 'snapshot', snapshot], function (err) {
                t.ok(!err, 'manual snapshot exists' + (err ? ': ' + err.message : ''));
                if (!err) {
                    VM.load(vmobj.uuid, function (e, o) {
                        t.ok(!e, 'reload VM after snap' + (e ? ': ' + e.message : ''));
                        if (!e) {
                            t.ok(o.snapshots.length === 0, 'have ' + o.snapshots.length + ' snapshots, expected: 0');
                        }
                        t.end();
                    });
                } else {
                    t.end();
                }
            });
        } else {
            t.end();
        }
    });
});

// try to create bad snapshot names

function createBadSnapshot(t, uuid, name, callback)
{
    VM.create_snapshot(uuid, name, {}, function (err) {
        t.ok(err, 'error creating snapshot "' + name + '" of ' + vmobj.uuid);
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (!e) {
                t.ok(o.snapshots.length === 0, '0 snapshots after create');
            } else {
                abort = true;
            }
            callback();
        });
    });
}

test('create snapshot with bad name', {'timeout': 240000}, function(t) {

    var bad_names = [
        'thisisareallylongsnapshotnamethatshouldbreakthingsbecauseitiswaytoolongforthemaxsnapshotnamevalue',
        '01234567890123456789012345678901234567890123456789012345678901234567890123456789',
        '!@#)!%*#^@)^#%$@U^@#)$*#@$!@#!@#',
        '\n',
        'bacon & eggs & ham',
        'one fish two fish red fish blue fish',
        'this,string,has,commas'
    ];

    if (abort) {
        t.ok(false, 'skipping snapshot as test run is aborted.');
        t.end();
        return;
    }

    function caller(name, cb) {
        createBadSnapshot(t, vmobj.uuid, name, cb);
    }

    async.forEach(bad_names, caller, function (err) {
        t.ok(!err, 'no extra errors from creating all the bad snapshots');
        t.end();
    });
});

test('write file to zoneroot then snapshot', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING1, function (err) {
        t.ok(!err, 'no error writing file to zoneroot');
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 1, '1 snapshot after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

test('write file to zoneroot again then snapshot again', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING2, function (err) {
        t.ok(!err, 'no error writing file to zoneroot' + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot2', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid);
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 2, '2 snapshots after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

test('try snapshot with same name again', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, 'snapshot2', {}, function (err) {
        t.ok(err, 'error creating duplicate snapshot2 of ' + vmobj.uuid + ': ' + (err ? ' ' + err.message : ''));
        t.end();
    });
});

test('write file to zoneroot one last time, then snapshot again', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING3, function (err) {
        t.ok(!err, 'no error writing file to zoneroot' + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot3', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid);
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 3, '3 snapshots after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot3'), 'snapshot3 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

test('rollback to snapshot2 and test data', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping rollback as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    VM.rollback_snapshot(vmobj.uuid, 'snapshot2', {}, function (err) {
        t.ok(!err, 'no error rolling back snapshot2 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));

        fs.readFile(filename, function (error, data) {
            t.ok(!error, 'no error reading file from ' + filename);
            if (error) {
                abort=true;
                t.end();
                return;
            } else {
                t.ok(data == MAGIC_STRING2, 'string in file is MAGIC_STRING2 [' + data + ',' + MAGIC_STRING2 + ']');
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after rollback to snapshot2');
                    if (e) {
                        abort=true;
                        t.end();
                        return;
                    }
                    // snapshot3 should have been deleted since it's newer
                    t.ok(o.snapshots.length === 2, '2 snapshots remain after rollback');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                    t.end();
                });
            }
        });
    });
});

test('rollback to snapshot1 and test data', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping rollback as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    VM.rollback_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
        t.ok(!err, 'no error rolling back snapshot1 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));

        fs.readFile(filename, function (error, data) {
            t.ok(!error, 'no error reading file from ' + filename);
            if (error) {
                abort=true;
                t.end();
                return;
            } else {
                t.ok(data == MAGIC_STRING1, 'string in file is MAGIC_STRING1 [' + data + ',' + MAGIC_STRING1 + ']');
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after rollback to snapshot1');
                    if (e) {
                        abort=true;
                        t.end();
                        return;
                    }
                    // snapshot3 should have been deleted since it's newer
                    t.ok(o.snapshots.length === 1, '1 snapshot remains after rollback');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    t.end();
                });
            }
        });
    });
});

test('delete snapshot1', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping deletion as test run is aborted.');
        t.end();
        return;
    }

    deleteSnapshot(t, vmobj.uuid, 'snapshot1', 0, function(err) {
        t.ok(!err, 'no error deleting snapshot1 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
        }
        t.end();
    });
});

test('create snapshot with numeric name that should succeed', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping snapshot as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, '20130131180505', {}, function (err) {
        t.ok(!err, 'no error creating 20130131180505 snapshot of ' + vmobj.uuid);
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (e) {
                abort=true;
                t.end();
                return;
            }
            t.ok(hasSnapshot(o.snapshots, '20130131180505'), '20130131180505 after create');
            deleteSnapshot(t, vmobj.uuid, '20130131180505', 0, function(err) {
                t.ok(!err, 'no error deleting 20130131180505 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
                if (err) {
                    abort = true;
                }
                t.end();
            });
        });
    });
});

function createSnapshot(t, uuid, snapname, expected_count, cb) {
    if (abort) {
        t.ok(false, 'skipping create as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, snapname, {}, function (err) {
        t.ok(!err, 'no error creating snapshot ' + snapname + ' of ' + vmobj.uuid + (err ? ': ' + err.message : ''));
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (!e) {
                t.ok(o.snapshots.length === expected_count, expected_count + ' snapshot(s) after create');
            } else {
                abort = true;
            }
            cb(e);
        });
    });
}

function deleteSnapshot(t, uuid, snapname, expected_remaining, cb) {
    if (abort) {
        t.ok(false, 'skipping delete as test run is aborted.');
        cb();
        return;
    }

    VM.delete_snapshot(vmobj.uuid, snapname, {}, function (err) {
        t.ok(!err, 'no error deleting ' + snapname + ' of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after delete of ' + snapname);
            if (e) {
                cb(e);
                return;
            }
            // snapshot3 should have been deleted since it's newer
            t.ok(o.snapshots.length === expected_remaining, o.snapshots.length
                + ' snapshots remain after rollback: [expected: '
                + expected_remaining + ']');
            cb();
        });
    });
};

function createXSnapshots(t, x, callback)
{
    if (abort) {
        t.ok(false, 'skipping create-delete as test run is aborted.');
        callback();
        return;
    }

    creates = 0;

    async.whilst(
    function () { return (!abort && creates < x); },
    function (cb) {
        var snapname;

        snapname='snapshot' + creates;

        createSnapshot(t, vmobj.uuid, snapname, (creates + 1), function (create_err) {
            if (create_err) {
                t.ok(!create_err, 'no errors creating snapshot "' + snapname + '" ' + (create_err ? ' ' + create_err.message : ''));
            }
            creates++;
            cb(create_err);
        });
    },
    function (err) {
        t.ok(!err, 'no errors creating ' + x + ' snapshots' + (err ? ': ' + err.message : ''));
        if (err) {
            abort = true;
        }
        callback(err);
    });
}

test('create 50 snapshots', {'timeout': 240000}, function(t) {

    createXSnapshots(t, 50, function (err) {
        t.end();
    });

});

test('delete 50 snapshots', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping create-delete as test run is aborted.');
        cb();
        return;
    }

    deletes = 49;

    async.whilst(
    function () { return (!abort && deletes >= 0); },
    function (callback) {
        var snapname;

        snapname='snapshot' + deletes;
        deleteSnapshot(t, vmobj.uuid, snapname, deletes, function (delete_err) {
            if (delete_err) {
                t.ok(!delete_err, 'no errors deleting snapshot "' + snapname + '" ' + (delete_err ? ' ' + delete_err.message : ''));
            }
            deletes--;
            callback(delete_err);
        });
    },
    function (err) {
        t.ok(!err, 'no errors deleting 50 snapshots' + (err ? ': ' + err.message : ''));
        if (err) {
            abort = true;
        }
        t.end();
    });
});

test('create/delete snapshot should update last_modified', {'timeout': 240000}, function(t) {

    var pre_snap_timestamp;
    var post_snap_timestamp;
    var post_delete_timestamp;

    if (abort) {
        t.ok(false, 'skipping create-delete last_modified test as test run is aborted.');
        cb();
        return;
    }

    async.series([
        function (cb) {
            VM.load(vmobj.uuid, function (err, obj) {
                t.ok(!err, 'loading VM before last_modified snapshot');
                if (!err) {
                    pre_snap_timestamp = obj.last_modified;
                }
                cb(err);
            });
        }, function (cb) {
            setTimeout(function () {
                createSnapshot(t, vmobj.uuid, 'modifyme', 1, function (err) {
                    t.ok(!err, 'created snapshot for last_modified test');
                    cb(err);
                });
            }, 1000);
        }, function (cb) {
            VM.load(vmobj.uuid, function (err, obj) {
                t.ok(!err, 'loaded VM after snapshot');
                if (!err) {
                    post_snap_timestamp = obj.last_modified;
                }
                cb(err);
            });
        }, function (cb) {
            setTimeout(function () {
                deleteSnapshot(t, vmobj.uuid, 'modifyme', 0, function (err) {
                    t.ok(!err, 'deleted snapshot for last_modified test');
                    cb(err);
                });
            }, 1000);
        }, function (cb) {
            VM.load(vmobj.uuid, function (err, obj) {
                t.ok(!err, 'loaded VM after delete snapshot');
                if (!err) {
                    post_delete_timestamp = obj.last_modified;
                }
                cb(err);
            });
        }
    ], function (err) {
        if (!err) {
            t.ok((Date.parse(pre_snap_timestamp) < Date.parse(post_snap_timestamp)),
                'create snapshot should have bumped last modified ['
                + pre_snap_timestamp  + ' < ' + post_snap_timestamp + ']');
            t.ok((Date.parse(post_snap_timestamp) < Date.parse(post_delete_timestamp)),
                'delete snapshot should have bumped last modified ['
                + post_snap_timestamp  + ' < ' + post_delete_timestamp + ']');
        }
        t.end();
    });
});

test('create/delete snapshot should handle mounting /checkpoints', {'timeout': 240000}, function(t) {
    var snapname = 'mountie';
    var checkpoint_dir = path.join(vmobj.zonepath, 'root', 'checkpoints', snapname);

    if (abort) {
        t.ok(false, 'skipping checkpoints tests');
        cb();
        return;
    }

    async.series([
        function (cb) {
            createSnapshot(t, vmobj.uuid, snapname, vmobj.snapshots.length + 1, function (err) {
                t.ok(!err, 'created snapshot for last_modified test');
                cb(err);
            });
        }, function (cb) {
            var passwd_file = path.join(checkpoint_dir + '/etc/passwd');

            fs.exists(passwd_file, function (exists) {
                var err;
                t.ok(exists, passwd_file + ' exists? ' + exists);
                if (!exists) {
                    err = new Error('unable to find /etc/passwd in ' + checkpoint_dir);
                }
                cb(err);
            });
        }, function (cb) {
            deleteSnapshot(t, vmobj.uuid, snapname, 0, function (err) {
                t.ok(!err, 'deleted ' + snapname + ' snapshot for ' + vmobj.uuid);
                cb(err);
            });
        }, function (cb) {

            fs.exists(checkpoint_dir, function (exists) {
                var err;
                t.ok(!exists, checkpoint_dir + ' exists? ' + exists);
                if (exists) {
                    err = new Error(checkpoint_dir + ' still exists after snapshot deletion');
                }
                cb(err);
            });
        }
    ], function (err) {
        t.ok(!err, 'testing /checkpoints: ' + (err ? err.message : 'success'));
        t.end();
    });
});


// create 10 snapshots (to test that deleting a VM with snapshots works)
test('create 10 more snapshots', {'timeout': 240000}, function(t) {

    createXSnapshots(t, 10, function (err) {
        t.end();
    });

});

test('delete zone', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping send as test run is aborted.');
        t.end();
        return;
    }

    if (vmobj.uuid) {
        VM.delete(vmobj.uuid, function (err) {
            if (err) {
                t.ok(false, 'error deleting VM: ' + err.message);
                abort = true;
            } else {
                t.ok(true, 'deleted VM: ' + vmobj.uuid);
            }
            t.end();
            vmobj = {};
        });
    } else {
        t.ok(false, 'no VM to delete');
        abort = true;
        t.end();
    }
});

// test that snapshots work on SNGL
test('create SNGL zone', {'timeout': 240000}, function(t) {
    var payload = {
        'brand': 'sngl',
        'autoboot': true,
        'image_uuid': sngl_image_uuid,
        'alias': 'test-sngl-snapshot-' + process.pid,
        'do_not_inventory': true
    };

    VM.create(payload, function (err, obj) {
        if (err) {
            t.ok(false, 'error creating VM: ' + err.message);
            t.end();
        } else {
            t.ok(true, 'VM created with uuid ' + obj.uuid);
            VM.load(obj.uuid, function (e, o) {
                t.ok(!err, 'loading VM after create');
                if (!err) {
                    t.ok(o.snapshots.length === 0, 'no snapshots after create');
                    t.ok(o.hasOwnProperty('zfs_filesystem'),
                        'has zfs_filesystem');
                    vmobj = o;
                } else {
                    abort = true;
                }
                t.end();
            });
        }
    });
});

// XXX duplicate of joyent-minimal test from above
test('write file to zoneroot then snapshot', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING1, function (err) {
        t.ok(!err, 'no error writing file to zoneroot');
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 1, '1 snapshot after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

// XXX duplicate of joyent-minimal test from above
test('write file to zoneroot again then snapshot again', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING2, function (err) {
        t.ok(!err, 'no error writing file to zoneroot' + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot2', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid);
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 2, '2 snapshots after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

// XXX duplicate of joyent-minimal test from above
test('write file to zoneroot one last time, then snapshot again', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping writing as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    fs.writeFile(filename, MAGIC_STRING3, function (err) {
        t.ok(!err, 'no error writing file to zoneroot' + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
            t.end();
        } else {
            VM.create_snapshot(vmobj.uuid, 'snapshot3', {}, function (err) {
                t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid);
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after create');
                    if (!e) {
                        t.ok(o.snapshots.length === 3, '3 snapshots after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                        t.ok(hasSnapshot(o.snapshots, 'snapshot3'), 'snapshot3 after create');
                    } else {
                        abort = true;
                    }
                    t.end();
                });
            });
        }
    });
});

// XXX duplicate of joyent-minimal test from above
test('rollback to snapshot2 and test data', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping rollback as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    VM.rollback_snapshot(vmobj.uuid, 'snapshot2', {}, function (err) {
        t.ok(!err, 'no error rolling back snapshot2 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));

        fs.readFile(filename, function (error, data) {
            t.ok(!error, 'no error reading file from ' + filename);
            if (error) {
                abort=true;
                t.end();
                return;
            } else {
                t.ok(data == MAGIC_STRING2, 'string in file is MAGIC_STRING2 [' + data + ',' + MAGIC_STRING2 + ']');
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after rollback to snapshot2');
                    if (e) {
                        abort=true;
                        t.end();
                        return;
                    }
                    // snapshot3 should have been deleted since it's newer
                    t.ok(o.snapshots.length === 2, '2 snapshots remain after rollback');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot2'), 'snapshot2 after create');
                    t.end();
                });
            }
        });
    });
});

// XXX duplicate of joyent-minimal test from above
test('rollback to snapshot1 and test data', {'timeout': 240000}, function(t) {
    if (abort) {
        t.ok(false, 'skipping rollback as test run is aborted.');
        t.end();
        return;
    }

    filename = path.join(vmobj.zonepath, 'root', '/root/hello.txt');

    VM.rollback_snapshot(vmobj.uuid, 'snapshot1', {}, function (err) {
        t.ok(!err, 'no error rolling back snapshot1 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));

        fs.readFile(filename, function (error, data) {
            t.ok(!error, 'no error reading file from ' + filename);
            if (error) {
                abort=true;
                t.end();
                return;
            } else {
                t.ok(data == MAGIC_STRING1, 'string in file is MAGIC_STRING1 [' + data + ',' + MAGIC_STRING1 + ']');
                VM.load(vmobj.uuid, function (e, o) {
                    t.ok(!e, 'loading VM after rollback to snapshot1');
                    if (e) {
                        abort=true;
                        t.end();
                        return;
                    }
                    // snapshot3 should have been deleted since it's newer
                    t.ok(o.snapshots.length === 1, '1 snapshot remains after rollback');
                    t.ok(hasSnapshot(o.snapshots, 'snapshot1'), 'snapshot1 after create');
                    t.end();
                });
            }
        });
    });
});

// XXX duplicate of joyent-minimal test from above
test('delete snapshot1', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping deletion as test run is aborted.');
        t.end();
        return;
    }

    deleteSnapshot(t, vmobj.uuid, 'snapshot1', 0, function(err) {
        t.ok(!err, 'no error deleting snapshot1 of ' + vmobj.uuid + (err ? ' ' + err.message : ''));
        if (err) {
            abort = true;
        }
        t.end();
    });
});

test('delete zone', function(t) {
    if (abort) {
        t.ok(false, 'skipping send as test run is aborted.');
        t.end();
        return;
    }
    if (vmobj.uuid) {
        VM.delete(vmobj.uuid, function (err) {
            if (err) {
                t.ok(false, 'error deleting VM: ' + err.message);
                abort = true;
            } else {
                t.ok(true, 'deleted VM: ' + vmobj.uuid);
            }
            t.end();
            vmobj = {};
        });
    } else {
        t.ok(false, 'no VM to delete');
        abort = true;
        t.end();
    }
});

test('create stopped zone', {'timeout': 240000}, function(t) {
    var payload = {
        'brand': 'joyent-minimal',
        'autoboot': false,
        'image_uuid': image_uuid,
        'alias': 'test-snapshot-' + process.pid,
        'do_not_inventory': true
    };

    VM.create(payload, function (err, obj) {
        if (err) {
            t.ok(false, 'error creating VM: ' + err.message);
            t.end();
        } else {
            t.ok(true, 'VM created with uuid ' + obj.uuid);
            VM.load(obj.uuid, function (e, o) {
                t.ok(!err, 'loading VM after create');
                if (!err) {
                    t.ok(o.snapshots.length === 0, 'no snapshots after create');
                    t.ok(o.hasOwnProperty('zfs_filesystem'),
                        'has zfs_filesystem');
                    vmobj = o;
                } else {
                    abort = true;
                }
                t.end();
            });
        }
    });
});

test('take snapshot (should not mount)', {'timeout': 240000}, function(t) {

    var filename;

    if (abort) {
        t.ok(false, 'skipping snapshot as test run is aborted.');
        t.end();
        return;
    }

    VM.create_snapshot(vmobj.uuid, 'shouldntmount', {}, function (err) {
        t.ok(!err, 'no error creating snapshot of ' + vmobj.uuid);
        VM.load(vmobj.uuid, function (e, o) {
            t.ok(!e, 'loading VM after create');
            if (!e) {
                t.ok(o.snapshots.length === 1, '1 snapshot after create');
                t.ok(hasSnapshot(o.snapshots, 'shouldntmount'), 'have snapshot "shouldntmount" after create');
                fs.exists(o.zonepath + '/root/checkpoints/shouldntmount/root', function (exists) {
                    t.ok(!exists, o.zonepath + '/root/checkpoints/shouldntmount wasn\'t mounted: ' + !exists);
                    t.end();
                });
            } else {
                abort = true;
                t.end();
            }
        });
    });
});

test('delete zone', {'timeout': 240000}, function(t) {

    if (abort) {
        t.ok(false, 'skipping send as test run is aborted.');
        t.end();
        return;
    }

    if (vmobj.uuid) {
        VM.delete(vmobj.uuid, function (err) {
            if (err) {
                t.ok(false, 'error deleting VM: ' + err.message);
                abort = true;
            } else {
                t.ok(true, 'deleted VM: ' + vmobj.uuid);
            }
            t.end();
            vmobj = {};
        });
    } else {
        t.ok(false, 'no VM to delete');
        abort = true;
        t.end();
    }
});
