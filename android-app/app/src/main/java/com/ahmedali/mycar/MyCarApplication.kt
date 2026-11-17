package com.ahmedali.mycar

import android.app.Application
import com.ahmedali.mycar.data.MyCarRepository
import com.ahmedali.mycar.data.db.MyCarDatabase
import com.ahmedali.mycar.worker.AlertCheckWorker
import com.ahmedali.mycar.worker.NotificationHelper

class MyCarApplication : Application() {
    val database: MyCarDatabase by lazy { MyCarDatabase.getInstance(this) }
    val repository: MyCarRepository by lazy { MyCarRepository(this, database) }

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannel(this)
        AlertCheckWorker.schedule(this)
    }
}
