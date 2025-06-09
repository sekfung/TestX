# Python IoT 消息测试示例

## 🚀 标准接口规范

所有Python代码必须实现 `generate_message()` 函数，返回包含以下字段的字典：

```python
{
    "topic": "string",      # IoT主题路径
    "qos_level": int,       # QoS等级 (0, 1, 2)
    "payload": "string"     # JSON格式的消息内容
}
```

## 📝 示例代码

### 1. 基础语音播报

```python
import json
import time
import random
from datetime import datetime

def generate_message():
    """基础语音播报示例"""
    device_id = f"speaker_{random.randint(1000, 9999)}"
    current_time = datetime.now().isoformat()
    
    return {
        "topic": f"/a1WvzjC1YpQ/{device_id}/user/service/voiceBroadcast",
        "qos_level": 1,
        "payload": json.dumps({
            "messageId": random.randint(10000, 99999),
            "command": "play",
            "content": "Hello from Python!",
            "timestamp": current_time,
            "volume": 50
        }, ensure_ascii=False)
    }
```

### 2. 批量设备控制

```python
import json
import random
from datetime import datetime

def generate_message():
    """批量设备控制示例"""
    device_ids = [f"device_{i:04d}" for i in range(1001, 1006)]
    selected_device = random.choice(device_ids)
    
    commands = ["play", "pause", "stop", "volume_up", "volume_down"]
    command = random.choice(commands)
    
    return {
        "topic": f"/a1WvzjC1YpQ/{selected_device}/user/control",
        "qos_level": 2,  # 确保命令可靠传输
        "payload": json.dumps({
            "messageId": random.randint(10000, 99999),
            "timestamp": datetime.now().isoformat(),
            "command": command,
            "params": {
                "volume": random.randint(0, 100) if command.startswith("volume") else None,
                "content": f"执行{command}命令" if command == "play" else None
            }
        }, ensure_ascii=False)
    }
```

### 3. 智能场景自动化

```python
import json
import random
from datetime import datetime, time

def generate_message():
    """智能场景自动化示例"""
    current_hour = datetime.now().hour
    
    # 根据时间判断场景
    if 6 <= current_hour <= 8:
        scene = "morning"
        content = "早上好！新的一天开始了。"
        volume = 30
    elif 12 <= current_hour <= 14:
        scene = "noon"
        content = "午餐时间到了，注意休息。"
        volume = 40
    elif 18 <= current_hour <= 20:
        scene = "evening"
        content = "晚上好！今天辛苦了。"
        volume = 35
    else:
        scene = "night"
        content = "夜深了，注意休息。"
        volume = 20
    
    device_id = f"home_speaker_{random.randint(1, 5)}"
    
    return {
        "topic": f"/a1WvzjC1YpQ/{device_id}/user/scene/{scene}",
        "qos_level": 1,
        "payload": json.dumps({
            "messageId": random.randint(10000, 99999),
            "scene": scene,
            "timestamp": datetime.now().isoformat(),
            "actions": [
                {
                    "type": "voice",
                    "content": content,
                    "volume": volume
                },
                {
                    "type": "light",
                    "brightness": volume + 20,
                    "color": "warm" if scene in ["morning", "evening"] else "cool"
                }
            ]
        }, ensure_ascii=False)
    }
```

### 4. 传感器数据模拟

```python
import json
import random
import time
from datetime import datetime

def generate_message():
    """传感器数据模拟示例"""
    sensor_types = ["temperature", "humidity", "air_quality", "noise"]
    sensor_type = random.choice(sensor_types)
    device_id = f"sensor_{sensor_type}_{random.randint(100, 999)}"
    
    # 生成模拟数据
    if sensor_type == "temperature":
        value = round(random.uniform(18.0, 28.0), 1)
        unit = "°C"
    elif sensor_type == "humidity":
        value = round(random.uniform(40.0, 80.0), 1)
        unit = "%"
    elif sensor_type == "air_quality":
        value = random.randint(0, 500)
        unit = "AQI"
    else:  # noise
        value = round(random.uniform(30.0, 80.0), 1)
        unit = "dB"
    
    return {
        "topic": f"/a1WvzjC1YpQ/{device_id}/user/data/report",
        "qos_level": 0,  # 传感器数据可以使用QoS 0
        "payload": json.dumps({
            "messageId": random.randint(10000, 99999),
            "deviceId": device_id,
            "sensorType": sensor_type,
            "timestamp": datetime.now().isoformat(),
            "data": {
                "value": value,
                "unit": unit,
                "status": "normal" if value < 100 else "warning"
            },
            "location": {
                "room": random.choice(["living_room", "bedroom", "kitchen", "office"]),
                "floor": random.randint(1, 3)
            }
        }, ensure_ascii=False)
    }
```

### 5. 条件逻辑示例

```python
import json
import random
from datetime import datetime, timedelta

def generate_message():
    """条件逻辑示例"""
    
    # 模拟不同的业务场景
    scenarios = ["emergency", "maintenance", "normal", "celebration"]
    scenario = random.choice(scenarios)
    
    base_topic = "/a1WvzjC1YpQ/smart_building_001/user"
    
    if scenario == "emergency":
        return {
            "topic": f"{base_topic}/emergency/alert",
            "qos_level": 2,  # 紧急情况使用最高QoS
            "payload": json.dumps({
                "messageId": random.randint(10000, 99999),
                "priority": "high",
                "type": "fire_alarm",
                "timestamp": datetime.now().isoformat(),
                "message": "火警警报！请立即疏散！",
                "actions": ["sound_alarm", "unlock_doors", "call_emergency"],
                "duration": 300  # 5分钟
            }, ensure_ascii=False)
        }
    
    elif scenario == "maintenance":
        return {
            "topic": f"{base_topic}/maintenance/schedule",
            "qos_level": 1,
            "payload": json.dumps({
                "messageId": random.randint(10000, 99999),
                "type": "scheduled_maintenance",
                "timestamp": datetime.now().isoformat(),
                "schedule": (datetime.now() + timedelta(hours=2)).isoformat(),
                "message": "系统将在2小时后进行维护",
                "affected_systems": ["hvac", "lighting", "security"],
                "estimated_duration": 120  # 2小时
            }, ensure_ascii=False)
        }
    
    elif scenario == "celebration":
        return {
            "topic": f"{base_topic}/entertainment/event",
            "qos_level": 1,
            "payload": json.dumps({
                "messageId": random.randint(10000, 99999),
                "event": "birthday_party",
                "timestamp": datetime.now().isoformat(),
                "message": "生日快乐！播放庆祝音乐",
                "playlist": ["happy_birthday", "celebration_music"],
                "light_effects": ["rainbow", "sparkle"],
                "volume": 60
            }, ensure_ascii=False)
        }
    
    else:  # normal
        return {
            "topic": f"{base_topic}/daily/reminder",
            "qos_level": 0,
            "payload": json.dumps({
                "messageId": random.randint(10000, 99999),
                "type": "daily_reminder",
                "timestamp": datetime.now().isoformat(),
                "message": "这是您的日常提醒",
                "reminders": [
                    "记得喝水",
                    "站起来活动一下",
                    "检查门窗是否关闭"
                ]
            }, ensure_ascii=False)
        }
```

## 🔧 调试技巧

### 1. 添加日志输出

```python
import json
import logging
from datetime import datetime

# 可以使用print进行调试，日志会显示在执行结果中
def generate_message():
    print("开始生成IoT消息...")
    
    device_id = "debug_device_001"
    print(f"使用设备ID: {device_id}")
    
    message_data = {
        "topic": f"/a1WvzjC1YpQ/{device_id}/user/debug",
        "qos_level": 1,
        "payload": json.dumps({
            "messageId": 12345,
            "timestamp": datetime.now().isoformat(),
            "debug": True,
            "message": "调试消息"
        }, ensure_ascii=False)
    }
    
    print(f"生成的消息: {message_data}")
    return message_data
```

### 2. 错误处理

```python
import json
from datetime import datetime

def generate_message():
    try:
        # 模拟可能出错的代码
        device_id = "safe_device_001"
        
        # 验证数据
        if not device_id:
            raise ValueError("设备ID不能为空")
        
        payload_data = {
            "messageId": 12345,
            "timestamp": datetime.now().isoformat(),
            "status": "ok"
        }
        
        # 确保payload是有效的JSON
        payload = json.dumps(payload_data, ensure_ascii=False)
        json.loads(payload)  # 验证JSON格式
        
        return {
            "topic": f"/a1WvzjC1YpQ/{device_id}/user/safe",
            "qos_level": 1,
            "payload": payload
        }
        
    except Exception as e:
        print(f"生成消息时出错: {e}")
        # 返回一个安全的默认消息
        return {
            "topic": "/a1WvzjC1YpQ/default_device/user/error",
            "qos_level": 0,
            "payload": json.dumps({
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }, ensure_ascii=False)
        }
```

## 📊 最佳实践

1. **Topic命名规范**: 遵循 `/product_key/device_name/user/service_type` 格式
2. **QoS选择**: 
   - QoS 0: 传感器数据、日志信息
   - QoS 1: 一般控制命令、通知消息  
   - QoS 2: 重要控制命令、安全相关消息
3. **Payload格式**: 始终使用JSON格式，包含messageId和timestamp
4. **错误处理**: 添加try-catch机制，确保代码健壮性
5. **调试输出**: 使用print语句帮助调试，日志会在执行结果中显示

## 🎯 注意事项

- generate_message()函数必须返回字典格式
- topic、qos_level、payload字段都是必需的
- payload必须是有效的JSON字符串
- QoS等级必须是0、1或2之间的整数
- 不要修改函数名称或返回格式 